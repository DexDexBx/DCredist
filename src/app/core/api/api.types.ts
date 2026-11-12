/**
 * CONTRATO DE RESPUESTA DEL API DE DCREDITS.
 *
 * Refleja tal cual lo que devuelve NestJS/Prisma (JSON). Los mappers de
 * `api.mappers.ts` traducen estas formas a los modelos de dominio del frontend,
 * de modo que ningun componente conoce el API.
 */

export type ApiUserRole = 'ADMIN' | 'COORDINATOR' | 'ORGANIZER' | 'OPERATOR' | 'VIEWER';
export type ApiUserStatus = 'ACTIVE' | 'INACTIVE';
export type ApiPermissionLevel = 'NONE' | 'VIEW' | 'MANAGE';

/** Permiso de un usuario en un modulo concreto. */
export interface ApiUserPermission {
  module: string;
  permission: ApiPermissionLevel;
}

/** Modulo del catalogo (GET /modules). */
export interface ApiModule {
  id: number;
  name: string;
}

/** Datos comunes del perfil. Nunca incluye el hash de la contrasena. */
export interface ApiUserBase {
  id: number;
  fullName: string;
  email: string;
  role: ApiUserRole;
  status: ApiUserStatus;
  /** Id de la escuela profesional del usuario. `general` = acceso global. */
  professionalSchoolId: number;
  professionalSchoolName: string;
  mustChangePassword: boolean;
}

/** Cambio de contraseña de la propia cuenta. */
export interface ApiChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ApiChangePasswordResult {
  changed: boolean;
  mustChangePassword: false;
}

/** Perfil que devuelve POST /auth/login, con su matriz completa de permisos. */
export interface ApiLoginResponse extends ApiUserBase {
  permissions: ApiUserPermission[];
}

/** Usuario del directorio tal como lo devuelve /users. */
export interface ApiUser extends ApiUserBase {
  permissionsOverridden: number;
  createdAt: string;
  updatedAt: string;
}

/** Respuesta de GET/PUT /users/:id/permissions. */
export interface ApiUserPermissions {
  permissions: ApiUserPermission[];
}

/** Cuerpo de alta o edicion. La contrasena viaja solo cuando se define. */
export interface ApiUserPayload {
  fullName: string;
  email: string;
  role: ApiUserRole;
  status: ApiUserStatus;
  password?: string;
  professionalSchoolId?: number;
}

/** El alta exige contrasena inicial. */
export interface ApiUserCreatePayload extends ApiUserPayload {
  password: string;
  professionalSchoolId: number;
}

/** La edicion solo envia los campos que cambian. */
export type ApiUserUpdatePayload = Partial<ApiUserPayload>;

// -----------------------------------------------------------------------------
// Catalogos
// -----------------------------------------------------------------------------

export type ApiCatalogStatus = 'ACTIVE' | 'INACTIVE';

export type ApiCatalogKind = 'organizers' | 'professionalSchools' | 'locations';

/** Entrada de catalogo con el conteo de registros que la usan. */
export interface ApiCatalogEntry {
  id: number;
  name: string;
  status: ApiCatalogStatus;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo de alta/edicion de una entrada de catalogo. */
export interface ApiCatalogPayload {
  name: string;
  status?: ApiCatalogStatus;
}

// -----------------------------------------------------------------------------
// Estudiantes
// -----------------------------------------------------------------------------

export type ApiStudentStatus = 'ACTIVE' | 'INACTIVE';

export type ApiStudentImportIssueCode =
  | 'MISSING_CODE'
  | 'DUPLICATE_IN_FILE'
  | 'MISSING_NAMES'
  | 'MISSING_PROFESSIONAL_SCHOOL'
  | 'MISSING_LOCATION'
  | 'UNKNOWN_PROFESSIONAL_SCHOOL'
  | 'UNKNOWN_LOCATION'
  | 'INACTIVE_PROFESSIONAL_SCHOOL'
  | 'INACTIVE_LOCATION'
  | 'FOREIGN_PROFESSIONAL_SCHOOL'
  | 'SCHOOL_MISMATCH'
  | 'LOCATION_MISMATCH'
  | 'DB_ERROR';

export interface ApiStudent {
  id: number;
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  professionalSchool: string;
  locationId: number;
  location: string;
  status: ApiStudentStatus;
  totalCredits: number;
  creditsTarget: number;
  progress: number;
  remainingCredits: number;
  completed: boolean;
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  pendingParticipations: number;
  eventsParticipated: number;
  pendingGrades: number;
}

/** Estudiante disponible para registrar en un evento (todas las escuelas). */
export interface ApiEligibleStudent {
  id: number;
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  professionalSchool: string;
  locationId: number;
  location: string;
  status: ApiStudentStatus;
}

export interface ApiCatalogFacet {
  id: number;
  name: string;
}

export interface ApiStudentFacets {
  professionalSchools: ApiCatalogFacet[];
  locations: ApiCatalogFacet[];
}

export interface ApiStudentImportIssue {
  row: number;
  universityCode: string;
  code: ApiStudentImportIssueCode;
  message: string;
}

export interface ApiStudentImportResult {
  total: number;
  created: number;
  enriched: number;
  issues: ApiStudentImportIssue[];
}

export type ApiConstancyStatus = 'ACTIVE' | 'INACTIVE';

/** Constancia persistida de creditos. */
export interface ApiConstancy {
  code: string;
  status: ApiConstancyStatus;
  issuedAt: string;
  creditsAtIssue: number;
  currentCredits: number;
}

/** Resumen de creditos devuelto al verificar una constancia. */
export interface ApiConstancySummary {
  studentId: number;
  totalCredits: number;
  creditsTarget: number;
  progress: number;
  remainingCredits: number;
  completed: boolean;
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  pendingParticipations: number;
  eventsParticipated: number;
  pendingGrades: number;
  certificateCount: number;
}

/** Resultado de verificar un codigo de constancia. */
export interface ApiConstancyVerificationResult {
  outcome: 'VALID' | 'NOT_ISSUED' | 'NOT_FOUND' | 'INVALID_FORMAT';
  message: string;
  constancy: ApiConstancy | null;
  student: ApiStudent | null;
  summary: ApiConstancySummary | null;
  issuedOn: string | null;
  meetsRequirement: boolean;
}

/** Escuela profesional del portal publico del estudiante. */
export interface ApiStudentPortalSchool {
  id: number;
  name: string;
}

/** Cuerpo de la consulta publica del estudiante. */
export interface ApiStudentPortalConsultPayload {
  universityCode: string;
  professionalSchoolId: number;
}

/** Participacion del estudiante con los datos publicos de su evento. */
export interface ApiStudentPortalHistoryItem {
  id: number;
  eventId: number;
  eventCode: string;
  eventName: string;
  eventTypeName: string;
  eventDateType: 'LONG' | 'SHORT';
  eventStartDate: string;
  eventEndDate: string;
  modality: string;
  location: string;
  participationDate: string;
  credits: number;
  grade: string;
  status: string;
  origin: string;
  descriptionStatus: string;
  verificationCode: string;
}

/** Resultado de validar el codigo y la escuela del estudiante. */
export interface ApiStudentPortalResult {
  id: number;
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  professionalSchool: string;
  locationId: number;
  location: string;
  status: string;
  totalCredits: number;
  creditsTarget: number;
  progress: number;
  remainingCredits: number;
  completed: boolean;
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  constancy: ApiConstancy | null;
  history: ApiStudentPortalHistoryItem[];
}

export type ApiEventType = 'SINGLE_DAY' | 'MULTI_DAY';
export type ApiEventModality = 'PRESENTIAL' | 'VIRTUAL' | 'HYBRID' | 'UNSPECIFIED';
export type ApiEventStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** Procedencia de un evento. */
export type ApiEventOrigin = 'CURRENT' | 'LEGACY';

/** Precision de la fecha del evento. */
export type ApiEventDateType = 'LONG' | 'SHORT';

/** Tipo de evento academico (GET /event-types). */
export interface ApiEventTypeEntry {
  id: number;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ApiEvent {
  id: number;
  code: string;
  name: string;
  description: string;
  durationType: ApiEventType;
  eventTypeId: number;
  /** Nombre del tipo en ingles; la interfaz lo traduce. */
  eventTypeName: string;
  startDate: string;
  endDate: string;
  modality: ApiEventModality;
  location: string;
  /** 0 significa sin limite. */
  capacity: number;
  organizerId: number;
  organizer: string;
  professionalSchoolId: number;
  professionalSchool: string;
  credits: number;
  status: ApiEventStatus;
  origin?: ApiEventOrigin;
  dateType?: ApiEventDateType;
  userCreate: string;
  userUpdate: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Fila de la carga masiva de eventos. */
export interface ApiEventImportRow {
  name: string;
  /** Precision de fechas de esta fila (obligatoria en la carga historica). */
  dateType?: ApiEventDateType;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventType?: string;
  modality?: string;
  location?: string;
  status?: string;
  capacity?: number;
  organizer: string;
  professionalSchool: string;
  credits?: number;
  code?: string;
}

/** Resultado de la carga masiva de eventos. */
export interface ApiEventImportResult {
  total: number;
  registered: number;
  skipped: number;
  valid?: number;
  issues: { row: number; name: string; code: string; message: string }[];
}

/** Evento resumido que devuelve el dashboard. */
export interface ApiDashboardEvent {
  id: number;
  code: string;
  name: string;
  eventTypeId: number;
  eventTypeName: string;
  startDate: string;
  endDate: string;
  modality: string;
  location: string;
  capacity: number;
  organizerId: number;
  organizer: string;
  professionalSchoolId: number;
  professionalSchool: string;
  credits: number;
  status: string;
  registeredCount: number;
}

export interface ApiDashboardTopStudent {
  studentId: number;
  name: string;
  universityCode: string;
  credits: number;
  participations: number;
}

export interface ApiDashboardSchoolSummary {
  professionalSchool: string;
  students: number;
  activeStudents: number;
  participations: number;
  validParticipations: number;
  totalCredits: number;
}

export interface ApiDashboardCreditsProgress {
  creditsTarget: number;
  totalCredits: number;
  remainingCredits: number;
  averageProgress: number;
  studentsCompleted: number;
  studentsWithCredits: number;
  totalStudents: number;
}

export interface ApiDashboardReport {
  totalEvents: number;
  activeEvents: number;
  scheduledEvents: number;
  completedEvents: number;
  totalStudents: number;
  activeStudents: number;
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  totalCredits: number;
  todayEvents: ApiDashboardEvent[];
  nextEvents: ApiDashboardEvent[];
  topStudents: ApiDashboardTopStudent[];
  schoolSummaries: ApiDashboardSchoolSummary[];
  creditsProgress: ApiDashboardCreditsProgress;
}

export type ApiParticipationStatus = 'VALID' | 'CANCELLED' | 'PENDING';

export interface ApiParticipationStudent {
  id: number;
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  professionalSchool: { name: string };
  locationId: number;
  location: { name: string };
  status: ApiStudentStatus;
}

/** Procedencia del registro de participacion. */
export type ApiParticipationOrigin = 'CURRENT' | 'LEGACY';

export interface ApiParticipation {
  id: number;
  eventId: number;
  studentId: number;
  /** Estudiante embebido por el API para evitar otra consulta al mostrarlo. */
  student?: ApiParticipationStudent;
  participationDate: string;
  credits: number;
  verificationCode: string;
  grade: string;
  status: ApiParticipationStatus;
  /** CURRENT: codigo generado por DCredits. LEGACY: codigo historico original. */
  origin?: ApiParticipationOrigin;
  /** Usuario que creo la participacion. */
  userCreate?: string;
  /** Usuario que la modifico por ultima vez. */
  userUpdate?: string;
  /** Motivo o descripcion del estado actual. */
  descriptionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Cuerpo de alta/edicion de un evento. `eventTypeId` referencia a `event_types`. */
export interface ApiEventPayload {
  code?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  modality?: ApiEventModality;
  location?: string;
  capacity?: number;
  eventTypeId?: number;
  organizerId?: number;
  professionalSchoolId?: number;
  credits?: number;
  status?: ApiEventStatus;
  origin?: ApiEventOrigin;
  dateType?: ApiEventDateType;
}

export interface ApiStudentPayload {
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  locationId: number;
  status?: ApiStudentStatus;
}

export interface ApiStudentImportRow {
  universityCode: string;
  lastName?: string;
  firstName?: string;
  professionalSchool?: string;
  location?: string;
}

export interface ApiParticipationPayload {
  eventId: number;
  studentId: number;
  participationDate?: string;
  credits?: number;
  grade?: string;
  status?: ApiParticipationStatus;
  /** Solo en registros LEGACY: codigo original que se conserva tal cual. */
  verificationCode?: string;
  origin?: ApiParticipationOrigin;
  /** Motivo del cambio de estado (anulacion o reactivacion). */
  descriptionStatus?: string;
}

/** Fila de la carga masiva de participaciones. */
export interface ApiParticipationImportRow {
  universityCode: string;
  grade?: string;
  /** Solo en cargas LEGACY. */
  verificationCode?: string;
}
