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

export type ApiEventType = 'SINGLE_DAY' | 'MULTI_DAY';
export type ApiEventModality = 'PRESENTIAL' | 'VIRTUAL' | 'HYBRID';
export type ApiEventStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

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
  eventType: ApiEventType;
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
  userCreate: string;
  userUpdate: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ApiParticipationStatus = 'VALID' | 'CANCELLED' | 'PENDING';

export interface ApiParticipation {
  id: number;
  eventId: number;
  studentId: number;
  participationDate: string;
  credits: number;
  verificationCode: string;
  grade: number | null;
  status: ApiParticipationStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Cuerpo de alta/edicion de un evento. `eventTypeId` referencia a `event_types`. */
export interface ApiEventPayload {
  code?: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  modality?: ApiEventModality;
  location?: string;
  capacity?: number;
  eventTypeId?: number;
  organizerId?: number;
  professionalSchoolId?: number;
  credits?: number;
  status?: ApiEventStatus;
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
  grade?: number | null;
  status?: ApiParticipationStatus;
}
