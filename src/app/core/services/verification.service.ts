import { Injectable, inject } from '@angular/core';
import {
  ConstancyVerificationResult,
  Participation,
  REQUIRED_CREDITS,
  StudentCreditSummary,
  VerificationResult,
  buildCertificateValidationCode,
  isValidVerificationCode,
  meetsCertificateRequirement,
  primaryCertificateCode,
} from '../../models';
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
 * MOCK SERVICE - CONSULTA Y VALIDACION DE PARTICIPACIONES.
 *
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
   * Verificacion de una CONSTANCIA de creditos (documento a nivel estudiante).
   *
   * El codigo tiene el formato CONST-<codigo universitario>-XXXXXX. Es
   * determinista: se reconstruye a partir del estudiante y se compara, de modo
   * que un codigo alterado no coincide.
   *
   * Ademas de que el codigo exista, la constancia debe seguir VIGENTE: el
   * estudiante tiene que mantener los creditos requeridos. Si los perdio (por
   * ejemplo, al anularse una participacion) la constancia ya no vale.
   */
  verifyConstancy(value: string): ConstancyVerificationResponse {
    const raw = value.trim().toUpperCase();

    if (!raw) {
      return {
        outcome: 'INVALID_FORMAT',
        message: 'Ingresa el código de la constancia para verificar.',
        result: null,
      };
    }

    const parts = raw.split('-');
    if (parts[0] !== 'CONST' || parts.length < 3) {
      return {
        outcome: 'INVALID_FORMAT',
        message: 'El código de constancia tiene el formato CONST-<código>-XXXXXX.',
        result: null,
      };
    }

    // El codigo universitario es todo lo que queda entre "CONST" y el hash final.
    const universityCode = parts.slice(1, -1).join('-');
    const student = this.studentService.findByUniversityCode(universityCode);

    if (!student || buildCertificateValidationCode(student).toUpperCase() !== raw) {
      return {
        outcome: 'NOT_FOUND',
        message: 'No encontramos ninguna constancia con ese código.',
        result: null,
      };
    }

    const history = this.creditService.getStudentHistory(student.id);
    const summary = this.creditService.getStudentCreditSummary(student.id);
    const meetsRequirement = meetsCertificateRequirement(summary.totalCredits);
    const result: ConstancyVerificationResult = {
      student,
      summary,
      issuedOn: this.constancyIssuedOn(history),
      meetsRequirement,
    };

    if (!meetsRequirement) {
      return {
        outcome: 'NOT_ISSUED',
        message: `El código es válido, pero el estudiante aún no alcanza los ${REQUIRED_CREDITS} créditos requeridos: la constancia no está vigente.`,
        result,
      };
    }

    return {
      outcome: 'VALID',
      message: 'Constancia verificada correctamente.',
      result,
    };
  }

  /**
   * Fecha en que se alcanzo el minimo de creditos: se acumulan las
   * participaciones vigentes de la mas antigua a la mas reciente y se toma la
   * que cruza el umbral. Es la fecha que se considera "emision" de la constancia.
   */
  private constancyIssuedOn(participations: Participation[]): string | null {
    const valid = participations
      .filter((participation) => participation.status === 'VALID')
      .slice()
      .sort((a, b) => a.participationDate.localeCompare(b.participationDate));

    let total = 0;
    for (const participation of valid) {
      total += participation.credits;
      if (total >= REQUIRED_CREDITS) {
        return participation.participationDate;
      }
    }

    return null;
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
