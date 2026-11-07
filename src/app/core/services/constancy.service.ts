import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConstancyRecord } from '../../models/constancy.model';
import { DcreditsApiClient } from '../api/dcredits-api.client';

/** Consulta de la constancia persistida de un estudiante (panel administrativo). */
@Injectable({ providedIn: 'root' })
export class ConstancyService {
  private readonly api = inject(DcreditsApiClient);

  async getForStudent(studentId: number): Promise<ConstancyRecord | null> {
    try {
      const row = await firstValueFrom(this.api.getStudentConstancy(studentId));
      return row
        ? {
            code: row.code,
            status: row.status,
            issuedAt: row.issuedAt,
            creditsAtIssue: row.creditsAtIssue,
            currentCredits: row.currentCredits,
          }
        : null;
    } catch {
      return null;
    }
  }
}
