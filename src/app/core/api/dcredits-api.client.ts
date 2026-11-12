import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from './api-endpoints';
import {
  ApiCatalogEntry,
  ApiChangePasswordPayload,
  ApiChangePasswordResult,
  ApiDashboardReport,
  ApiConstancy,
  ApiConstancyVerificationResult,
  ApiCatalogKind,
  ApiCatalogPayload,
  ApiEvent,
  ApiEventDateType,
  ApiEventImportResult,
  ApiEventImportRow,
  ApiEventOrigin,
  ApiEventPayload,
  ApiEligibleStudent,
  ApiEventTypeEntry,
  ApiLoginResponse,
  ApiParticipation,
  ApiParticipationImportRow,
  ApiParticipationOrigin,
  ApiParticipationPayload,
  ApiStudent,
  ApiStudentFacets,
  ApiStudentImportResult,
  ApiStudentImportRow,
  ApiStudentPayload,
  ApiStudentPortalConsultPayload,
  ApiStudentPortalResult,
  ApiStudentPortalSchool,
  ApiModule,
  ApiUser,
  ApiUserCreatePayload,
  ApiUserPermissions,
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

  changePassword(payload: ApiChangePasswordPayload): Observable<ApiChangePasswordResult> {
    return this.http.post<ApiChangePasswordResult>(
      API_ENDPOINTS.authChangePassword,
      payload
    );
  }

  login(email: string, password: string): Observable<ApiLoginResponse> {
    return this.http.post<ApiLoginResponse>(API_ENDPOINTS.authLogin, { email, password });
  }

  // --- Usuarios ---

  listUsers(): Observable<ApiUser[]> {
    return this.http.get<ApiUser[]>(API_ENDPOINTS.users);
  }

  getUser(id: number): Observable<ApiUser> {
    return this.http.get<ApiUser>(API_ENDPOINTS.user(id));
  }

  createUser(payload: ApiUserCreatePayload): Observable<ApiUser> {
    return this.http.post<ApiUser>(API_ENDPOINTS.users, payload);
  }

  updateUser(id: number, payload: ApiUserUpdatePayload): Observable<ApiUser> {
    return this.http.patch<ApiUser>(API_ENDPOINTS.user(id), payload);
  }

  getUserPermissions(id: number): Observable<ApiUserPermissions> {
    return this.http.get<ApiUserPermissions>(API_ENDPOINTS.userPermissions(id));
  }

  updateUserPermissions(
    id: number,
    payload: ApiUserPermissions
  ): Observable<ApiUserPermissions> {
    return this.http.put<ApiUserPermissions>(API_ENDPOINTS.userPermissions(id), payload);
  }

  // --- Modulos ---

  listModules(): Observable<ApiModule[]> {
    return this.http.get<ApiModule[]>(API_ENDPOINTS.modules);
  }

  // --- Reportes ---

  getDashboardReport(): Observable<ApiDashboardReport> {
    return this.http.get<ApiDashboardReport>(API_ENDPOINTS.reportsDashboard);
  }

  // --- Catalogos ---

  /**
   * Lista las entradas de un catalogo. `includeGeneral` solo aplica a escuelas
   * y solo lo respeta el API para usuarios globales.
   */
  listCatalog(
    kind: ApiCatalogKind,
    options: { search?: string; status?: string; includeGeneral?: boolean } = {}
  ): Observable<ApiCatalogEntry[]> {
    let params = new HttpParams();

    if (options.search?.trim()) {
      params = params.set('search', options.search.trim());
    }
    if (options.status) {
      params = params.set('status', options.status);
    }
    if (options.includeGeneral) {
      params = params.set('includeGeneral', 'true');
    }

    return this.http.get<ApiCatalogEntry[]>(catalogBase(kind), { params });
  }

  createCatalogEntry(
    kind: ApiCatalogKind,
    payload: ApiCatalogPayload
  ): Observable<ApiCatalogEntry> {
    return this.http.post<ApiCatalogEntry>(catalogBase(kind), payload);
  }

  updateCatalogEntry(
    kind: ApiCatalogKind,
    id: number,
    payload: Partial<ApiCatalogPayload>
  ): Observable<ApiCatalogEntry> {
    return this.http.patch<ApiCatalogEntry>(catalogItem(kind, id), payload);
  }

  deleteCatalogEntry(kind: ApiCatalogKind, id: number): Observable<void> {
    return this.http.delete<void>(catalogItem(kind, id));
  }

  // --- Eventos ---

  listEvents(): Observable<ApiEvent[]> {
    return this.http.get<ApiEvent[]>(API_ENDPOINTS.events);
  }

  createEvent(payload: ApiEventPayload): Observable<ApiEvent> {
    return this.http.post<ApiEvent>(API_ENDPOINTS.events, payload);
  }

  importEvents(
    rows: ApiEventImportRow[],
    origin: ApiEventOrigin = 'CURRENT',
    dateType: ApiEventDateType = 'LONG'
  ): Observable<ApiEventImportResult> {
    return this.http.post<ApiEventImportResult>(API_ENDPOINTS.eventsImport, {
      origin,
      dateType,
      rows,
    });
  }

  validateEventsImport(
    rows: ApiEventImportRow[],
    origin: ApiEventOrigin = 'CURRENT',
    dateType: ApiEventDateType = 'LONG'
  ): Observable<ApiEventImportResult> {
    return this.http.post<ApiEventImportResult>(API_ENDPOINTS.eventsImportValidate, {
      origin,
      dateType,
      rows,
    });
  }

  listEventTypes(): Observable<ApiEventTypeEntry[]> {
    return this.http.get<ApiEventTypeEntry[]>(API_ENDPOINTS.eventTypes);
  }

  updateEvent(id: number, payload: Partial<ApiEventPayload>): Observable<ApiEvent> {
    return this.http.patch<ApiEvent>(API_ENDPOINTS.event(id), payload);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.event(id));
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

  updateStudent(id: number, payload: Partial<ApiStudentPayload>): Observable<ApiStudent> {
    return this.http.patch<ApiStudent>(API_ENDPOINTS.student(id), payload);
  }

  deleteStudent(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.student(id));
  }

  importStudents(rows: ApiStudentImportRow[]): Observable<ApiStudentImportResult> {
    return this.http.post<ApiStudentImportResult>(API_ENDPOINTS.studentImport, { rows });
  }

  // --- Portal publico del estudiante ---

  getStudentConstancy(studentId: number): Observable<ApiConstancy | null> {
    return this.http.get<ApiConstancy | null>(API_ENDPOINTS.studentConstancy(studentId));
  }

  listStudentPortalSchools(): Observable<ApiStudentPortalSchool[]> {
    return this.http.get<ApiStudentPortalSchool[]>(API_ENDPOINTS.studentPortalSchools);
  }

  consultStudentPortal(
    payload: ApiStudentPortalConsultPayload
  ): Observable<ApiStudentPortalResult> {
    return this.http.post<ApiStudentPortalResult>(API_ENDPOINTS.studentPortalConsult, payload);
  }

  // --- Participaciones ---

  listParticipations(): Observable<ApiParticipation[]> {
    return this.http.get<ApiParticipation[]>(API_ENDPOINTS.participations);
  }

  listEligibleStudents(eventId: number): Observable<ApiEligibleStudent[]> {
    return this.http.get<ApiEligibleStudent[]>(API_ENDPOINTS.eligibleStudents, {
      params: new HttpParams().set('eventId', String(eventId)),
    });
  }

  listParticipationStudents(): Observable<ApiEligibleStudent[]> {
    return this.http.get<ApiEligibleStudent[]>(API_ENDPOINTS.participationStudents);
  }

  createParticipation(payload: ApiParticipationPayload): Observable<ApiParticipation> {
    return this.http.post<ApiParticipation>(API_ENDPOINTS.participations, payload);
  }

  updateParticipation(
    id: number,
    payload: Partial<ApiParticipationPayload>
  ): Observable<ApiParticipation> {
    return this.http.patch<ApiParticipation>(API_ENDPOINTS.participation(id), payload);
  }

  deleteParticipation(id: number): Observable<void> {
    return this.http.delete<void>(API_ENDPOINTS.participation(id));
  }

  importParticipations(
    eventId: number,
    rows: ApiParticipationImportRow[],
    origin: ApiParticipationOrigin = 'CURRENT'
  ): Observable<ApiParticipationImportResult> {
    return this.http.post<ApiParticipationImportResult>(API_ENDPOINTS.participationImport, {
      eventId,
      origin,
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

  verifyConstancy(code: string): Observable<ApiConstancyVerificationResult> {
    return this.http.get<ApiConstancyVerificationResult>(
      API_ENDPOINTS.verificationConstancy(code)
    );
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

/** URL base de cada catalogo. */
function catalogBase(kind: ApiCatalogKind): string {
  switch (kind) {
    case 'professionalSchools':
      return API_ENDPOINTS.professionalSchools;
    case 'locations':
      return API_ENDPOINTS.locations;
    case 'organizers':
      return API_ENDPOINTS.organizers;
  }
}

function catalogItem(kind: ApiCatalogKind, id: number): string {
  switch (kind) {
    case 'professionalSchools':
      return API_ENDPOINTS.professionalSchool(id);
    case 'locations':
      return API_ENDPOINTS.location(id);
    case 'organizers':
      return API_ENDPOINTS.organizer(id);
  }
}
