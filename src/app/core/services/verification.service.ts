import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ConstancyVerificationResult,
  Participation,
  StudentCreditSummary,
  VerificationResult,
  isValidVerificationCode,
  primaryCertificateCode,
} from '../../models';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { CreditService } from './credit.service';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';

export type VerificationOutcome =
  | 'VALID'
  | 'INVALID_FORMAT'
  | 'NOT_FOUND'
  | 'CANCELLED'
  /** El codigo existe, pero el estudiante ya no alcanza los creditos: la constancia no esta vigente. */
  | 'NOT_ISSUED';

export interface VerificationResponse {
  outcome: VerificationOutcome;
  message: string;
  result: VerificationResult | null;
  credits: StudentCreditSummary | null;
}

/** Respuesta de la verificacion a nivel CONSTANCIA (documento de creditos). */
export interface ConstancyVerificationResponse {
  outcome: VerificationOutcome;
  message: string;
  result: ConstancyVerificationResult | null;
}

/**
 * SERVICIO - CONSULTA Y VALIDACION DE PARTICIPACIONES.
 *
 * Opera sobre los eventos, estudiantes y participaciones cargados del API.
 * Permite a un estudiante (o a la institucion) confirmar si un codigo de
 * DCredits corresponde a una participacion real.
 *
 * Reglas:
 *  - se acepta CUALQUIERA de los dos codigos del certificado: el vigente
 *    (DC-AAAA-XXXXXX) o el del sistema anterior. Un certificado ya impreso debe
 *    seguir siendo localizable con el codigo que el estudiante conoce,
 *  - un codigo con formato DC se normaliza (prefijo "DC-" opcional, mayusculas);
 *    un codigo anterior se busca tal cual, porque su forma es parte del dato,
 *  - una participacion anulada responde "Anulada": el codigo existio, pero ya no
 *    otorga creditos.
 *
 * Contrato de API: GET /verify/:code
 */
@Injectable({ providedIn: 'root' })
export class VerificationService {
  private readonly participationService = inject(ParticipationService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly creditService = inject(CreditService);
  private readonly api = inject(DcreditsApiClient);

  /** Completa el prefijo por comodidad: "2026-8F4K2P" -> "DC-2026-8F4K2P". */
  normalizeInput(value: string): string {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return '';
    }
    return trimmed.startsWith('DC-') ? trimmed : `DC-${trimmed}`;
  }

  /**
   * Como se interpreta lo que el usuario escribio.
   *
   * Un codigo con formato DC se corrige antes de buscar (prefijo, mayusculas).
   * Cualquier otra cosa se toma como codigo anterior y se busca tal cual, sin
   * "corregirlo": su nomenclatura no sigue ningun patron.
   */
  private resolveLookup(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    return isValidVerificationCode(this.normalizeInput(trimmed))
      ? this.normalizeInput(trimmed)
      : trimmed;
  }

  /** Verificacion completa, con mensajes listos para mostrar en la interfaz. */
  verify(value: string): VerificationResponse {
    const code = this.resolveLookup(value);

    if (!code) {
      return {
        outcome: 'INVALID_FORMAT',
        message: 'Ingresa un código de participación para verificar.',
        result: null,
        credits: null,
      };
    }

    const participation = this.participationService.findByCertificateCode(code);

    if (!participation) {
      return {
        outcome: 'NOT_FOUND',
        message: 'No encontramos ninguna participación con ese código.',
        result: null,
        credits: null,
      };
    }

    const result: VerificationResult = {
      participation,
      event: this.eventService.findById(participation.eventId),
      student: this.studentService.findById(participation.studentId),
    };

    if (participation.status === 'CANCELLED') {
      return {
        outcome: 'CANCELLED',
        message: 'La participación existe, pero fue anulada y no otorga créditos.',
        result,
        credits: null,
      };
    }

    return {
      outcome: 'VALID',
      message: 'Participación verificada correctamente.',
      result,
      credits: result.student
        ? this.creditService.getStudentCreditSummary(result.student.id)
        : null,
    };
  }

  /**
   * Verificacion de una CONSTANCIA de creditos.
   *
   * El codigo ya no se reconstruye en el frontend: se consulta el registro
   * persistido en `constancies`. El backend ademas sincroniza los creditos y el
   * estado antes de responder.
   */
  async verifyConstancy(value: string): Promise<ConstancyVerificationResponse> {
    const code = value.trim();
    if (!code) {
      return {
        outcome: 'INVALID_FORMAT',
        message: 'Ingresa el código de la constancia para verificar.',
        result: null,
      };
    }

    try {
      const row = await firstValueFrom(this.api.verifyConstancy(code));

      return {
        outcome: row.outcome,
        message: row.message,
        result:
          row.student && row.summary
            ? {
                student: row.student,
                summary: row.summary,
                issuedOn: row.issuedOn,
                meetsRequirement: row.meetsRequirement,
                constancy: row.constancy,
              }
            : null,
      };
    } catch (error) {
      return {
        outcome: 'NOT_FOUND',
        message: this.constancyErrorMessage(error),
        result: null,
      };
    }
  }

  private constancyErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
      return detail ?? `No se pudo verificar la constancia (HTTP ${error.status}).`;
    }

    return 'No se pudo conectar con el servidor para verificar la constancia.';
  }

  /** Verificacion simple: devuelve el resultado o null si el codigo no existe. */
  find(code: string): VerificationResult | null {
    const participation = this.participationService.findByCertificateCode(
      this.resolveLookup(code)
    );

    if (!participation) {
      return null;
    }

    return {
      participation,
      event: this.eventService.findById(participation.eventId),
      student: this.studentService.findById(participation.studentId),
    };
  }

  /**
   * Busqueda incremental mientras se escribe el codigo.
   *
   * Solo propone participaciones que tienen ALGO que verificar: sin codigo DC
   * ni anterior no hay nada que la pantalla pueda mostrar.
   */
  suggest(value: string, limit = 5): VerificationResult[] {
    const needle = value.trim().toLowerCase();
    if (needle.length < 3) {
      return [];
    }

    return this.participationService
      .getParticipations({ search: needle })
      .filter((participation) => primaryCertificateCode(participation) !== null)
      .slice(0, limit)
      .map((participation) => ({
        participation,
        event: this.eventService.findById(participation.eventId),
        student: this.studentService.findById(participation.studentId),
      }));
  }
}
