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
  id: string;
  name: string;
}

/** Datos comunes del perfil. Nunca incluye el hash de la contrasena. */
export interface ApiUserBase {
  id: string;
  fullName: string;
  email: string;
  role: ApiUserRole;
  status: ApiUserStatus;
  professionalSchool: string;
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
  professionalSchool?: string;
}

/** El alta exige contrasena inicial. */
export interface ApiUserCreatePayload extends ApiUserPayload {
  password: string;
}

/** La edicion solo envia los campos que cambian. */
export type ApiUserUpdatePayload = Partial<ApiUserPayload>;

export type ApiStudentStatus = 'ACTIVE' | 'INACTIVE';
export type ApiStudentImportIssueCode =
  | 'MISSING_CODE'
  | 'DUPLICATE_IN_FILE'
  | 'MISSING_NAMES'
  | 'DB_ERROR';

export interface ApiStudent {
  id: string;
  universityCode: string;
  academicDegree: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  headquarters: string;
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

export interface ApiStudentFacets {
  professionalSchools: string[];
  headquarters: string[];
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

export interface ApiEvent {
  id: string;
  code: string;
  name: string;
  description: string;
  eventType: ApiEventType;
  category: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  modality: ApiEventModality;
  location: string;
  capacity: number | null;
  organizer: string;
  credits: number;
  status: ApiEventStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type ApiParticipationType =
  | 'ASISTENTE'
  | 'PONENTE'
  | 'PANELISTA'
  | 'INVITADO'
  | 'ORGANIZADOR';

export type ApiParticipationStatus = 'VALID' | 'CANCELLED' | 'PENDING';

export interface ApiParticipation {
  id: string;
  eventId: string;
  studentId: string;
  participationType: ApiParticipationType;
  participationDate: string;
  credits: number;
  verificationCode: string;
  grade: number | null;
  status: ApiParticipationStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Cuerpo de alta/edicion de un evento. `category` es el "tipo" del dominio. */
export interface ApiEventPayload {
  code?: string;
  name: string;
  description?: string;
  category?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  modality?: ApiEventModality;
  location?: string;
  capacity?: number | null;
  organizer?: string;
  credits?: number;
  status?: ApiEventStatus;
}

export interface ApiStudentPayload {
  universityCode: string;
  academicDegree?: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  headquarters: string;
  status?: ApiStudentStatus;
}

export interface ApiStudentImportRow {
  universityCode: string;
  academicDegree?: string;
  lastName?: string;
  firstName?: string;
  professionalSchool?: string;
  headquarters?: string;
}

export interface ApiParticipationPayload {
  eventId: string;
  studentId: string;
  participationType?: ApiParticipationType;
  participationDate?: string;
  credits?: number;
  grade?: number | null;
  status?: ApiParticipationStatus;
}
