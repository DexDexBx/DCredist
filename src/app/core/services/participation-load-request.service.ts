import { Injectable, inject, signal } from '@angular/core';
import {
  ParticipationLoadRequest,
  ParticipationLoadRequestDraft,
  LoadRequestStatus,
} from '../../models';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';

/**
 * MOCK SERVICE - SOLICITUDES DE CARGA (datos en memoria, sin backend).
 *
 * Contrato de API que debe conservar al migrar a HttpClient:
 *   GET   /events/:id/load-requests
 *   POST  /load-requests
 *   PATCH /load-requests/:id
 *
 * La solicitud de recarga nace en un canal EXTERNO: alguien (una escuela, un
 * organizador, un area) sube una lista adicional una vez cerrada la primera
 * carga y declara el motivo por el que llego tarde. DCredits no origina la
 * solicitud: la registra CON LA CARGA ADJUNTA, deja trazabilidad y resuelve su
 * estado (pendiente, aprobada o rechazada).
 *
 * Al APROBAR la solicitud, la carga adjunta se registra de inmediato como lote
 * extemporaneo (modo LATE) y el evento vuelve a quedar cerrado.
 */
@Injectable({ providedIn: 'root' })
export class ParticipationLoadRequestService {
  private readonly eventService = inject(EventService);
  private readonly participationService = inject(ParticipationService);

  private readonly requestsState = signal<ParticipationLoadRequest[]>([]);

  readonly requests = this.requestsState.asReadonly();

  private sequence = 0;

  /** Solicitudes de un evento, de la mas reciente a la mas antigua. */
  requestsForEvent(eventId: string): ParticipationLoadRequest[] {
    return this.requestsState().filter((request) => request.eventId === eventId);
  }

  /** Solicitud pendiente mas reciente del evento, si existe. */
  pendingForEvent(eventId: string): ParticipationLoadRequest | undefined {
    return this.requestsState().find(
      (request) => request.eventId === eventId && request.status === 'PENDING'
    );
  }

  /**
   * Registra una solicitud con su carga adjunta (codigos de la lista).
   *
   * Queda PENDIENTE hasta que un responsable la apruebe o la rechace.
   */
  create(draft: ParticipationLoadRequestDraft): ParticipationLoadRequest | null {
    const requestedBy = draft.requestedBy.trim();
    const reason = draft.reason.trim();
    const codes = draft.codes.map((code) => code.trim()).filter((code) => code.length > 0);
    if (!draft.eventId || !requestedBy || !reason || codes.length === 0) {
      return null;
    }

    const request: ParticipationLoadRequest = {
      id: this.nextId(),
      eventId: draft.eventId,
      requestedBy,
      reason,
      codes,
      fileName: draft.fileName?.trim() || null,
      requestedAt: new Date().toISOString(),
      status: 'PENDING',
      resolvedBy: null,
      resolvedAt: null,
      resolutionNote: null,
      batchId: null,
      registeredCount: null,
      skippedCount: null,
    };

    this.requestsState.update((current) => [request, ...current]);
    return request;
  }

  /**
   * APRUEBA la solicitud y registra su carga adjunta como lote extemporaneo.
   *
   * Habilita la recarga del evento (con quien resuelve y el motivo declarado) y
   * valida + confirma los codigos. Al confirmar, el evento vuelve a quedar
   * cerrado. El resultado (lote, registrados, omitidos) queda en la solicitud.
   */
  async approve(
    id: string,
    options: { resolvedBy: string; note?: string }
  ): Promise<ParticipationLoadRequest | null> {
    const request = this.requestsState().find((item) => item.id === id);
    if (!request || request.status !== 'PENDING') {
      return null;
    }

    const resolvedBy = options.resolvedBy.trim() || 'Coordinación DCredits';

    // Abre la recarga para que la validacion acepte registros con el evento cerrado.
    this.eventService.enableLateImports(request.eventId, {
      enabledBy: resolvedBy,
      reason: request.reason,
    });

    const stage1 = this.participationService.importStage1(request.codes);
    const stage2 = this.participationService.importStage2(request.eventId, stage1.items);
    const summary = await this.participationService.importStage2Commit(
      request.eventId,
      stage2.items.filter((item) => item.valid),
      { mode: 'LATE', uploadedBy: request.requestedBy }
    );

    return this.resolve(id, 'APPROVED', resolvedBy, options.note, {
      batchId: summary.batchId,
      registeredCount: summary.registered,
      skippedCount: summary.skipped,
    });
  }

  /** RECHAZA la solicitud: no se registra ninguna carga. */
  reject(
    id: string,
    options: { resolvedBy: string; note?: string }
  ): ParticipationLoadRequest | null {
    const request = this.requestsState().find((item) => item.id === id);
    if (!request || request.status !== 'PENDING') {
      return null;
    }

    const resolvedBy = options.resolvedBy.trim() || 'Coordinación DCredits';
    return this.resolve(id, 'REJECTED', resolvedBy, options.note);
  }

  private resolve(
    id: string,
    status: LoadRequestStatus,
    resolvedBy: string,
    note?: string,
    extra?: Partial<ParticipationLoadRequest>
  ): ParticipationLoadRequest | null {
    let result: ParticipationLoadRequest | null = null;

    this.requestsState.update((current) =>
      current.map((request) => {
        if (request.id !== id) {
          return request;
        }
        result = {
          ...request,
          ...extra,
          status,
          resolvedBy,
          resolvedAt: new Date().toISOString(),
          resolutionNote: (note ?? '').trim() || null,
        };
        return result;
      })
    );

    return result;
  }

  private nextId(): string {
    this.sequence += 1;
    return `SOL-${new Date().getFullYear()}-${String(this.sequence).padStart(4, '0')}`;
  }
}
