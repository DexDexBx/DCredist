import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AcademicEvent,
  EVENT_MODALITIES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EventDraft,
  EventModality,
  EventStatus,
  EventType,
  EventValidation,
  acceptsParticipations,
  isImportCompleted,
  isLateImportsEnabled,
} from '../../models';
import { mapApiEvent, toApiEventPayload } from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { DataModeService } from './data-mode.service';

/**
 * SERVICE - EVENTOS ACADEMICOS.
 *
 * Lee del API (hidratado al arrancar) y escribe contra el backend cuando esta
 * disponible; sin API opera en memoria como antes. Contrato:
 *   GET   /events
 *   POST  /events
 *   PATCH /events/:id
 *
 * Validaciones de dominio (se aplican antes de tocar el API o el estado local):
 *  - fecha de fin >= fecha de inicio (sin limite artificial de duracion),
 *  - hora de fin > hora de inicio cuando ambas existen,
 *  - creditos >= 0,
 *  - capacidad nula o positiva.
 */
@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly eventsState = signal<AcademicEvent[]>([]);

  readonly events = this.eventsState.asReadonly();

  /**
   * Reemplaza el listado con el que devuelve el API (hidratacion al arrancar).
   *
   * Los eventos del backend no traen campos de importacion (lotes, cierre,
   * recargas): quedan ausentes y el evento se considera con registro abierto.
   */
  replaceAll(events: AcademicEvent[]): void {
    this.eventsState.set(events);
  }

  readonly eventTypes: readonly EventType[] = EVENT_TYPES;
  readonly modalities: readonly EventModality[] = EVENT_MODALITIES;
  readonly statuses: readonly EventStatus[] = EVENT_STATUSES;

  readonly upcomingEvents = computed(() =>
    this.eventsState()
      .filter((event) => event.status === 'Programado' || event.status === 'En curso')
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  );

  readonly activeEvents = computed(
    () => this.eventsState().filter((event) => event.status === 'En curso')
  );

  findById(id: string): AcademicEvent | undefined {
    return this.eventsState().find((event) => event.id === id);
  }

  filter(options: {
    status?: EventStatus | 'Todos';
    modality?: EventModality | 'Todas';
    search?: string;
    code?: string;
    school?: string;
    faculty?: string;
    professionalSchool?: string;
  }): AcademicEvent[] {
    const search = options.search?.trim().toLowerCase() ?? '';
    const code = options.code?.trim().toLowerCase() ?? '';
    const school = options.school?.trim().toLowerCase() ?? options.faculty?.trim().toLowerCase() ?? options.professionalSchool?.trim().toLowerCase() ?? '';

    return this.eventsState()
      .filter((event) => {
        const matchesStatus =
          !options.status || options.status === 'Todos'
            ? true
            : event.status === options.status;
        const matchesModality =
          !options.modality || options.modality === 'Todas'
            ? true
            : event.modality === options.modality;
        const matchesCode = !code || event.code.toLowerCase().includes(code);
        const matchesSchool =
          !school ||
          (event.organizer?.toLowerCase().includes(school) ?? false) ||
          (event.location?.toLowerCase().includes(school) ?? false) ||
          (event.description?.toLowerCase().includes(school) ?? false);
        const matchesSearch =
          !search ||
          event.name.toLowerCase().includes(search) ||
          event.code.toLowerCase().includes(search) ||
          event.eventType.toLowerCase().includes(search) ||
          (event.organizer?.toLowerCase().includes(search) ?? false) ||
          (event.description?.toLowerCase().includes(search) ?? false);

        return matchesStatus && matchesModality && matchesCode && matchesSchool && matchesSearch;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  searchEvents(query: string): AcademicEvent[] {
    const term = query?.trim().toLowerCase() ?? '';
    if (!term) return this.openEvents();
    return this.openEvents().filter((event) => {
      return (
        event.name.toLowerCase().includes(term) ||
        event.code.toLowerCase().includes(term) ||
        (event.organizer?.toLowerCase().includes(term) ?? false) ||
        (event.description?.toLowerCase().includes(term) ?? false) ||
        (event.location?.toLowerCase().includes(term) ?? false)
      );
    });
  }

  get openEvents() {
    return computed(() => this.eventsState().filter((event) => acceptsParticipations(event)));
  }

  validate(draft: EventDraft): EventValidation {
    const errors: EventValidation['errors'] = {};

    if (!draft.name.trim()) {
      errors.name = 'El nombre del evento es obligatorio.';
    }

    const start = new Date(draft.startDate);
    const end = new Date(draft.endDate);

    if (Number.isNaN(start.getTime())) {
      errors.startDate = 'Indica una fecha de inicio válida.';
    }

    if (Number.isNaN(end.getTime())) {
      errors.endDate = 'Indica una fecha de término válida.';
    }

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      if (end.getTime() < start.getTime()) {
        errors.endDate = 'La fecha de término no puede ser anterior a la de inicio.';
      }

      const sameDay =
        start.getFullYear() === end.getFullYear() &&
        start.getMonth() === end.getMonth() &&
        start.getDate() === end.getDate();

      if (sameDay && end.getTime() <= start.getTime()) {
        errors.endDate = 'La hora de término debe ser posterior a la de inicio.';
      }
    }

    if (!draft.location.trim()) {
      errors.location = 'El lugar es obligatorio.';
    }

    if (!draft.organizer.trim()) {
      errors.organizer = 'El organizador es obligatorio.';
    }

    if (draft.credits === null || draft.credits === undefined || draft.credits < 0) {
      errors.credits = 'Los créditos no pueden ser negativos.';
    }

    if (draft.capacity !== null && draft.capacity !== undefined && draft.capacity < 0) {
      errors.capacity = 'La capacidad no puede ser negativa.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  async create(draft: EventDraft): Promise<AcademicEvent | null> {
    if (!this.validate(draft).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const created = await firstValueFrom(this.api.createEvent(toApiEventPayload(draft)));
        const event = mapApiEvent(created);
        this.eventsState.update((current) => [...current, event]);
        return event;
      } catch {
        return null;
      }
    }

    return this.createLocal(draft);
  }

  private createLocal(draft: EventDraft): AcademicEvent {
    const sequence = this.eventsState().length + 1;
    const event: AcademicEvent = {
      id: `evt-${String(sequence).padStart(3, '0')}`,
      code: draft.code?.trim() || `EVT-${new Date().getFullYear()}-${String(sequence).padStart(3, '0')}`,
      name: draft.name.trim(),
      description: draft.description.trim(),
      eventType: draft.eventType,
      startDate: new Date(draft.startDate).toISOString(),
      endDate: new Date(draft.endDate).toISOString(),
      modality: draft.modality,
      location: draft.location.trim(),
      status: draft.status,
      capacity: draft.capacity,
      organizer: draft.organizer.trim(),
      credits: draft.credits,
      tags: draft.tags,
    };

    this.eventsState.update((current) => [...current, event]);
    return event;
  }

  async update(id: string, draft: EventDraft): Promise<AcademicEvent | null> {
    const current = this.findById(id);
    if (!current || !this.validate(draft).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const updated = await firstValueFrom(
          this.api.updateEvent(id, toApiEventPayload(draft))
        );
        const event = mapApiEvent(updated);
        this.eventsState.update((list) => list.map((item) => (item.id === id ? event : item)));
        return event;
      } catch {
        return null;
      }
    }

    return this.updateLocal(id, draft);
  }

  private updateLocal(id: string, draft: EventDraft): AcademicEvent {
    const current = this.findById(id) as AcademicEvent;
    const event: AcademicEvent = {
      ...current,
      name: draft.name.trim(),
      description: draft.description.trim(),
      eventType: draft.eventType,
      startDate: new Date(draft.startDate).toISOString(),
      endDate: new Date(draft.endDate).toISOString(),
      modality: draft.modality,
      location: draft.location.trim(),
      status: draft.status,
      capacity: draft.capacity,
      organizer: draft.organizer.trim(),
      credits: draft.credits,
      tags: draft.tags,
    };

    this.eventsState.update((current) =>
      current.map((item) => (item.id === id ? event : item))
    );
    return event;
  }

  /**
   * MARCA LA CARGA DE LA LISTA COMO COMPLETA.
   *
   * Cierra el registro del evento: `importCompletedAt` existe y `importLocked`
   * queda en true. A partir de ahi solo se admiten registros habilitando
   * cargas extemporaneas. Es idempotente: cerrar un evento ya cerrado no cambia
   * la fecha original.
   *
   * Contrato de API: POST /events/:id/import/complete
   */
  markImportComplete(
    eventId: string,
    options: { completedBy?: string } = {}
  ): AcademicEvent | null {
    const current = this.findById(eventId);
    if (!current || isImportCompleted(current)) {
      return current ?? null;
    }

    return this.patchEvent(eventId, {
      importCompletedAt: new Date().toISOString(),
      importCompletedBy: (options.completedBy ?? '').trim() || null,
      importLocked: true,
    });
  }

  /**
   * HABILITA LAS CARGAS EXTEMPORANEAS.
   *
   * Reabre el evento en modo LATE. Queda registrado quien lo autorizo, cuando y
   * con que motivo: es la trazabilidad que exige el registro de participacion.
   * No permite habilitarlas si la carga no se cerro antes.
   *
   * Contrato de API: POST /events/:id/import/late
   */
  enableLateImports(
    eventId: string,
    options: { enabledBy: string; reason: string }
  ): AcademicEvent | null {
    const current = this.findById(eventId);
    if (!current || !isImportCompleted(current)) {
      return null;
    }

    const enabledBy = options.enabledBy.trim();
    const reason = options.reason.trim();
    if (!enabledBy || !reason) {
      return null;
    }

    return this.patchEvent(eventId, {
      lateImportsEnabledAt: new Date().toISOString(),
      lateImportsEnabledBy: enabledBy,
      lateImportsReason: reason,
    });
  }

  /** Vuelve a cerrar el evento: deja de admitir cargas extemporaneas. */
  disableLateImports(eventId: string): AcademicEvent | null {
    const current = this.findById(eventId);
    if (!current || !isLateImportsEnabled(current)) {
      return current ?? null;
    }

    return this.patchEvent(eventId, {
      lateImportsEnabledAt: null,
      lateImportsEnabledBy: null,
      lateImportsReason: null,
    });
  }

  /**
   * Registra el lote confirmado por una importacion.
   *
   * La importacion normal guarda su lote en `importBatchId`; la extemporanea en
   * `lateImportBatchId`. En ambos casos se deja constancia de quien subio la
   * lista. Es lo que la vista muestra como trazabilidad de la carga.
   *
   * El estado de la carga se actualiza AQUI, de forma automatica:
   *  - la PRIMERA carga cierra el registro (no lo marca el usuario),
   *  - una recarga extemporanea reabre el registro solo mientras se sube; al
   *    confirmarla, el evento vuelve a quedar cerrado.
   */
  recordImportBatch(
    eventId: string,
    batch: { batchId: string; mode: 'NORMAL' | 'LATE'; uploadedBy?: string }
  ): AcademicEvent | null {
    const current = this.findById(eventId);
    if (!current) {
      return null;
    }

    const patch: Partial<AcademicEvent> = {
      importUploadedBy: (batch.uploadedBy ?? '').trim() || null,
    };

    if (batch.mode === 'LATE') {
      patch.lateImportBatchId = batch.batchId;
      // La recarga cumplio su objetivo: el evento vuelve a quedar cerrado.
      patch.lateImportsEnabledAt = null;
      patch.lateImportsEnabledBy = null;
      patch.lateImportsReason = null;
    } else {
      patch.importBatchId = batch.batchId;
      // La primera carga cierra el registro automaticamente.
      if (!isImportCompleted(current)) {
        patch.importCompletedAt = new Date().toISOString();
        patch.importCompletedBy = (batch.uploadedBy ?? '').trim() || null;
        patch.importLocked = true;
      }
    }

    return this.patchEvent(eventId, patch);
  }

  /**
   * Renombra el organizador en todo el historico.
   *
   * Lo usa el catalogo de organizadores: al corregir el nombre, los eventos ya
   * registrados tienen que apuntar al nombre nuevo. Devuelve cuantos cambiaron.
   */
  renameOrganizer(previous: string, next: string): number {
    if (previous === next) {
      return 0;
    }

    let changed = 0;
    const updated = this.eventsState().map((event) => {
      if (event.organizer !== previous) {
        return event;
      }
      changed++;
      return { ...event, organizer: next };
    });

    if (changed > 0) {
      this.eventsState.set(updated);
    }

    return changed;
  }

  /** Cambio interno del evento, sin pasar por la validacion del formulario. */
  private patchEvent(id: string, patch: Partial<AcademicEvent>): AcademicEvent | null {    let result: AcademicEvent | null = null;

    this.eventsState.update((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }
        result = { ...item, ...patch };
        return result;
      })
    );

    return result;
  }
}
