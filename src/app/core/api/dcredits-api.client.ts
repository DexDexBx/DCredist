import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from './api-endpoints';
import {
  ApiEvent,
  ApiEventPayload,
  ApiLoginResponse,
  ApiParticipation,
  ApiParticipationPayload,
  ApiStudent,
  ApiStudentFacets,
  ApiStudentImportResult,
  ApiStudentImportRow,
  ApiStudentPayload,
  ApiUser,
  ApiUserCreatePayload,
  ApiUserUpdatePayload,
} from './api.types';

/**
 * CLIENTE HTTP DEL API DE DCREDITS.
 *
 * Unico punto que conoce las URLs y los cuerpos que espera NestJS. Los servicios
 * de dominio traducen con `api.mappers.ts` y nunca hablan HTTP directamente.
 *
 * El prefijo `/api` lo resuelve el proxy de desarrollo (angular.json) hacia
 * `http://localhost:3000`; en produccion lo resuelve el reverse proxy.
 */
@Injectable({ providedIn: 'root' })
export class DcreditsApiClient {
  private readonly http = inject(HttpClient);

  // --- Autenticacion ---

  login(email: string, password: string): Observable<ApiLoginResponse> {
    return this.http.post<ApiLoginResponse>(API_ENDPOINTS.authLogin, { email, password });
  }

  // --- Usuarios ---

  listUsers(): Observable<ApiUser[]> {
    return this.http.get<ApiUser[]>(API_ENDPOINTS.users);
  }

  getUser(id: string): Observable<ApiUser> {
    return this.http.get<ApiUser>(API_ENDPOINTS.user(id));
  }

  createUser(payload: ApiUserCreatePayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(API_ENDPOINTS.users, payload);
  }

  updateUser(id: string, payload: ApiUserUpdatePayload): Observable<ApiUser> {
    return this.http.patch<ApiUser>(API_ENDPOINTS.user(id), payload);
  }

  // --- Eventos ---

  listEvents(): Observable<ApiEvent[]> {
    return this.http.get<ApiEvent[]>(API_ENDPOINTS.events);
  }

  createEvent(payload: ApiEventPayload): Observable<ApiEvent> {
    return this.http.post<ApiEvent>(API_ENDPOINTS.events, payload);
  }

  updateEvent(id: string, payload: Partial<ApiEventPayload>): Observable<ApiEvent> {
    return this.http.patch<ApiEvent>(API_ENDPOINTS.event(id), payload);
  }

  // --- Estudiantes ---

  listStudents(): Observable<ApiStudent[]> {
    return this.http.get<ApiStudent[]>(API_ENDPOINTS.students);
  }

  studentFacets(): Observable<ApiStudentFacets> {
    return this.http.get<ApiStudentFacets>(`${API_ENDPOINTS.students}/facets`);
  }

  createStudent(payload: ApiStudentPayload): Observable<ApiStudent> {
    return this.http.post<ApiStudent>(API_ENDPOINTS.students, payload);
  }

  updateStudent(id: string, payload: Partial<ApiStudentPayload>): Observable<ApiStudent> {
    return this.http.patch<ApiStudent>(API_ENDPOINTS.student(id), payload);
  }

  importStudents(rows: ApiStudentImportRow[]): Observable<ApiStudentImportResult> {
    return this.http.post<ApiStudentImportResult>(API_ENDPOINTS.studentImport, { rows });
  }

  // --- Participaciones ---

  listParticipations(): Observable<ApiParticipation[]> {
    return this.http.get<ApiParticipation[]>(API_ENDPOINTS.participations);
  }

  createParticipation(payload: ApiParticipationPayload): Observable<ApiParticipation> {
    return this.http.post<ApiParticipation>(API_ENDPOINTS.participations, payload);
  }

  updateParticipation(
    id: string,
    payload: Partial<ApiParticipationPayload>
  ): Observable<ApiParticipation> {
    return this.http.patch<ApiParticipation>(API_ENDPOINTS.participation(id), payload);
  }

  importParticipations(
    eventId: string,
    rows: { universityCode: string }[]
  ): Observable<ApiParticipationImportResult> {
    return this.http.post<ApiParticipationImportResult>(API_ENDPOINTS.participationImport, {
      eventId,
      rows,
    });
  }

  // --- Verificacion ---

  verify(code: string): Observable<unknown> {
    return this.http.get(`${API_ENDPOINTS.verification(code)}`);
  }

  suggestCodes(query: string, limit = 5): Observable<string[]> {
    const params = new HttpParams().set('q', query).set('limit', String(limit));
    return this.http.get<string[]>(API_ENDPOINTS.verificationBase, { params });
  }
}

/** Resultado de la carga masiva de participaciones. */
export interface ApiParticipationImportResult {
  total: number;
  registered: number;
  found: number;
  skipped: number;
  issues: { row: number; universityCode: string; code: string; message: string }[];
}
