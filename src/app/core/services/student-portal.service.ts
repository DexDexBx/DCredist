import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  StudentPortalConsultResult,
  StudentPortalProfile,
  StudentPortalSchool,
} from '../../models/student-portal.model';
import { ApiStudentPortalResult } from '../api/api.types';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { maskSurnames } from '../../shared/utils/text.utils';

/**
 * PORTAL PUBLICO DEL ESTUDIANTE.
 *
 * Consulta escuelas y valida codigo + escuela contra el API publico. No usa la
 * sesion administrativa: estos endpoints no requieren X-User-Id.
 */
@Injectable({ providedIn: 'root' })
export class StudentPortalService {
  private readonly api = inject(DcreditsApiClient);

  /** Escuelas activas para el selector. Lanza si el API no responde. */
  async listSchools(): Promise<StudentPortalSchool[]> {
    const rows = await firstValueFrom(this.api.listStudentPortalSchools());
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async consult(
    universityCode: string,
    professionalSchoolId: number
  ): Promise<StudentPortalConsultResult> {
    try {
      const row = await firstValueFrom(
        this.api.consultStudentPortal({
          universityCode: universityCode.trim(),
          professionalSchoolId,
        })
      );

      return { ok: true, student: mapProfile(row) };
    } catch (error) {
      return { ok: false, message: this.errorMessage(error) };
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
      return detail ?? `No se pudo realizar la consulta (HTTP ${error.status}).`;
    }

    return 'No se pudo conectar con el servidor. Intenta nuevamente.';
  }
}

function mapProfile(row: ApiStudentPortalResult): StudentPortalProfile {
  return {
    id: row.id,
    universityCode: row.universityCode,
    lastName: maskSurnames(row.lastName),
    firstName: row.firstName,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchool: row.professionalSchool,
    location: row.location,
    status: row.status,
    totalCredits: row.totalCredits,
    creditsTarget: row.creditsTarget,
    progress: row.progress,
    remainingCredits: row.remainingCredits,
    completed: row.completed,
    totalParticipations: row.totalParticipations,
    validParticipations: row.validParticipations,
    cancelledParticipations: row.cancelledParticipations,
    constancy: row.constancy
      ? {
          code: row.constancy.code,
          status: row.constancy.status,
          issuedAt: row.constancy.issuedAt,
          creditsAtIssue: row.constancy.creditsAtIssue,
          currentCredits: row.constancy.currentCredits,
        }
      : null,
    history: row.history.map((item) => ({
      id: item.id,
      eventId: item.eventId,
      eventCode: item.eventCode,
      eventName: item.eventName,
      eventTypeName: item.eventTypeName,
      eventDateType: item.eventDateType,
      eventStartDate: item.eventStartDate,
      eventEndDate: item.eventEndDate,
      modality: item.modality,
      location: item.location,
      participationDate: item.participationDate,
      credits: item.credits,
      grade: item.grade,
      status: item.status,
      origin: item.origin,
      descriptionStatus: item.descriptionStatus,
      verificationCode: item.verificationCode,
    })),
  };
}
