import {
  AcademicEvent,
  CatalogEntry,
  CatalogStatus,
  EventDraft,
  EventModality,
  EventStatus,
  MODULES,
  ModuleKey,
  Participation,
  ParticipationDraft,
  PermissionMap,
  ROLE_DESCRIPTIONS,
  Student,
  StudentDraft,
  UserCreateDraft,
  UserProfile,
  UserUpdateDraft,
} from '../../models';
import type { StudentImportRow } from '../services/student.service';
import {
  ApiCatalogEntry,
  ApiEvent,
  ApiEventModality,
  ApiEligibleStudent,
  ApiEventPayload,
  ApiEventStatus,
  ApiModule,
  ApiParticipation,
  ApiParticipationPayload,
  ApiStudent,
  ApiStudentImportRow,
  ApiStudentPayload,
  ApiUser,
  ApiUserCreatePayload,
  ApiUserPermission,
  ApiUserPermissions,
  ApiUserUpdatePayload,
} from './api.types';
import { initialsOf } from '../../shared/utils/text.utils';

/** Formato del API -> etiqueta de dominio. */
const MODALITY_FROM_API: Record<ApiEventModality, EventModality> = {
  PRESENTIAL: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrido',
  UNSPECIFIED: 'No especificado',
};

const MODALITY_TO_API: Record<EventModality, ApiEventModality> = {
  Presencial: 'PRESENTIAL',
  Virtual: 'VIRTUAL',
  Híbrido: 'HYBRID',
  'No especificado': 'UNSPECIFIED',
};

/** DRAFT y SCHEDULED se muestran igual: el dominio de la interfaz no tiene borrador. */
const STATUS_FROM_API: Record<ApiEventStatus, EventStatus> = {
  DRAFT: 'Programado',
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const STATUS_TO_API: Record<EventStatus, ApiEventStatus> = {
  Programado: 'SCHEDULED',
  'En curso': 'IN_PROGRESS',
  Finalizado: 'COMPLETED',
  Cancelado: 'CANCELLED',
};

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/** Fecha calendario "YYYY-MM-DD" (sin hora) para eventos. */
function toDateOnly(value: string): string {
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(value.trim())) {
    return value.trim();
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function mapApiEligibleStudent(row: ApiEligibleStudent): Student {
  return {
    id: row.id,
    universityCode: row.universityCode,
    lastName: row.lastName,
    firstName: row.firstName,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchool: row.professionalSchool,
    locationId: row.locationId,
    location: row.location,
    status: row.status,
  };
}

export function mapApiStudent(row: ApiStudent): Student {
  return {
    id: row.id,
    universityCode: row.universityCode,
    lastName: row.lastName,
    firstName: row.firstName,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchool: row.professionalSchool,
    locationId: row.locationId,
    location: row.location,
    status: row.status,
  };
}

export function mapApiUser(row: ApiUser): UserProfile {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    status: row.status,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchoolName: row.professionalSchoolName,
    initials: initialsOf(row.fullName),
    description: ROLE_DESCRIPTIONS[row.role],
    permissions: null,
    permissionsOverridden: row.permissionsOverridden ?? 0,
    mustChangePassword: row.mustChangePassword === true,
  };
}

/** Convierte la matriz del API al mapa que consumen guards, menú y botones. */
export function mapApiPermissions(rows: ApiUserPermission[]): PermissionMap {
  const permissions = {} as PermissionMap;

  for (const module of MODULES) {
    permissions[module.key] = 'NONE';
  }
  for (const row of rows) {
    if (isModuleKey(row.module)) {
      permissions[row.module] = row.permission;
    }
  }

  return permissions;
}

/** Envía la matriz completa: el API reemplaza todas las filas del usuario. */
export function toApiPermissionsPayload(permissions: PermissionMap): ApiUserPermissions {
  return {
    permissions: MODULES.map((module) => ({
      module: module.key,
      permission: permissions[module.key],
    })),
  };
}

function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((module) => module.key === value);
}

export function mapApiCatalogEntry(row: ApiCatalogEntry): CatalogEntry {
  return {
    id: row.id,
    name: row.name,
    status: row.status as CatalogStatus,
    usageCount: row.usageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapApiEvent(row: ApiEvent): AcademicEvent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    eventTypeId: row.eventTypeId,
    eventTypeName: row.eventTypeName,
    startDate: toDateOnly(row.startDate),
    endDate: toDateOnly(row.endDate),
    modality: MODALITY_FROM_API[row.modality] ?? 'Presencial',
    location: row.location,
    status: STATUS_FROM_API[row.status] ?? 'Programado',
    origin: row.origin === 'LEGACY' ? 'LEGACY' : 'CURRENT',
    dateType: row.dateType === 'SHORT' ? 'SHORT' : 'LONG',
    capacity: row.capacity ?? 0,
    organizerId: row.organizerId,
    organizer: row.organizer,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchool: row.professionalSchool,
    credits: row.credits,
    userCreate: row.userCreate ?? '',
    userUpdate: row.userUpdate ?? '',
  };
}

export function mapApiParticipation(row: ApiParticipation): Participation {
  return {
    id: row.id,
    eventId: row.eventId,
    studentId: row.studentId,
    student: row.student
      ? {
          id: row.student.id,
          universityCode: row.student.universityCode,
          lastName: row.student.lastName,
          firstName: row.student.firstName,
          professionalSchoolId: row.student.professionalSchoolId,
          professionalSchool: row.student.professionalSchool?.name ?? '',
          locationId: row.student.locationId,
          location: row.student.location?.name ?? '',
          status: row.student.status,
        }
      : undefined,
    // La fecha de participacion es un dia calendario, no una marca de tiempo.
    // Se normaliza a YYYY-MM-DD para que no se desplace de dia por la zona horaria.
    participationDate: toDateOnly(row.participationDate),
    credits: row.credits,
    verificationCode: row.verificationCode,
    legacyCode: null,
    grade: row.grade,
    status: row.status,
    origin: row.origin === 'LEGACY' ? 'LEGACY' : 'CURRENT',
    userCreate: row.userCreate ?? '',
    userUpdate: row.userUpdate ?? '',
    // El motivo de anulacion/reactivacion se guarda en la tabla participations.
    // Sin este mapeo la ficha y la constancia nunca lo reciben.
    descriptionStatus: row.descriptionStatus ?? 'valid',
  };
}

export function toApiEventPayload(draft: EventDraft): ApiEventPayload {
  const dateType = draft.dateType ?? 'LONG';

  return {
    ...(draft.code?.trim() ? { code: draft.code.trim() } : {}),
    name: draft.name.trim(),
    // La descripcion es opcional: vacia viaja ausente y el backend la rellena.
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    eventTypeId: draft.eventTypeId ?? undefined,
    // SHORT envia solo mes/anio; el backend duplica la fecha con dia 29.
    startDate: dateType === 'SHORT' ? draft.startDate.trim() : toDateOnly(draft.startDate),
    ...(dateType === 'SHORT' ? {} : { endDate: toDateOnly(draft.endDate) }),
    dateType,
    modality: MODALITY_TO_API[draft.modality],
    ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
    capacity: draft.capacity,
    organizerId: draft.organizerId ?? undefined,
    professionalSchoolId: draft.professionalSchoolId ?? undefined,
    credits: draft.credits,
    status: STATUS_TO_API[draft.status],
    origin: draft.origin === 'LEGACY' ? 'LEGACY' : 'CURRENT',
  };
}

/**
 * PATCH real: solo envia los campos que cambiaron respecto al evento actual.
 * El backend acepta actualizaciones parciales, asi que editar una sola fecha
 * no reescribe todo el evento.
 */
export function toApiEventPatch(
  draft: EventDraft,
  current: AcademicEvent,
): Partial<ApiEventPayload> {
  const full = toApiEventPayload(draft);
  const patch: Partial<ApiEventPayload> = {};

  if (full.code && full.code !== current.code) {
    patch.code = full.code;
  }
  if (full.name !== current.name) {
    patch.name = full.name;
  }
  if ((full.description ?? '') !== (current.description ?? '')) {
    patch.description = full.description;
  }
  if (full.eventTypeId !== current.eventTypeId) {
    patch.eventTypeId = full.eventTypeId;
  }

  const dateType = draft.dateType ?? 'LONG';
  if (dateType !== (current.dateType ?? 'LONG')) {
    patch.dateType = dateType;
  }

  if (dateType === 'SHORT') {
    const currentMonth = current.startDate.slice(0, 7);
    if (draft.startDate.trim() !== currentMonth) {
      patch.startDate = draft.startDate.trim();
    }
  } else {
    if (full.startDate !== current.startDate) {
      patch.startDate = full.startDate;
    }
    if (full.endDate !== current.endDate) {
      patch.endDate = full.endDate;
    }
  }
  if (MODALITY_FROM_API[full.modality ?? 'PRESENTIAL'] !== current.modality) {
    patch.modality = full.modality;
  }
  if ((full.location ?? '') !== (current.location ?? '')) {
    patch.location = full.location;
  }
  if ((full.capacity ?? 0) !== (current.capacity ?? 0)) {
    patch.capacity = full.capacity;
  }
  if (full.organizerId !== current.organizerId) {
    patch.organizerId = full.organizerId;
  }
  if (full.professionalSchoolId !== current.professionalSchoolId) {
    patch.professionalSchoolId = full.professionalSchoolId;
  }
  if (full.credits !== current.credits) {
    patch.credits = full.credits;
  }
  if (STATUS_FROM_API[full.status ?? 'DRAFT'] !== current.status) {
    patch.status = full.status;
  }

  return patch;
}

export function toApiStudentPayload(draft: StudentDraft): ApiStudentPayload {
  return {
    universityCode: draft.universityCode.trim(),
    lastName: draft.lastName.trim(),
    firstName: draft.firstName.trim(),
    professionalSchoolId: draft.professionalSchoolId,
    locationId: draft.locationId,
    status: draft.status,
  };
}

/** PATCH real: solo envia los campos que cambiaron respecto al estudiante actual. */
export function toApiStudentPatch(
  draft: StudentDraft,
  current: Student,
): Partial<ApiStudentPayload> {
  const patch: Partial<ApiStudentPayload> = {};
  const universityCode = draft.universityCode.trim();

  if (universityCode !== current.universityCode) {
    patch.universityCode = universityCode;
  }
  if (draft.lastName.trim() !== current.lastName) {
    patch.lastName = draft.lastName.trim();
  }
  if (draft.firstName.trim() !== current.firstName) {
    patch.firstName = draft.firstName.trim();
  }
  if (draft.professionalSchoolId !== current.professionalSchoolId) {
    patch.professionalSchoolId = draft.professionalSchoolId;
  }
  if (draft.locationId !== current.locationId) {
    patch.locationId = draft.locationId;
  }
  if (draft.status !== current.status) {
    patch.status = draft.status;
  }

  return patch;
}

export function toApiStudentImportRows(rows: StudentImportRow[]): ApiStudentImportRow[] {
  return rows.map((row) => ({
    universityCode: row.universityCode.trim(),
    lastName: row.lastName?.trim() || undefined,
    firstName: row.firstName?.trim() || undefined,
    professionalSchool: row.professionalSchool?.trim() || undefined,
    location: row.location?.trim() || undefined,
  }));
}

export function toApiParticipationPayload(draft: ParticipationDraft): ApiParticipationPayload {
  const origin = draft.origin ?? 'CURRENT';
  const verificationCode = (draft.verificationCode ?? '').trim();

  return {
    eventId: draft.eventId,
    studentId: draft.studentId,
    credits: draft.credits,
    grade: draft.grade?.trim() || undefined,
    origin,
    // El codigo solo viaja en registros historicos; en los actuales lo genera
    // el servidor.
    ...(origin === 'LEGACY' && verificationCode ? { verificationCode } : {}),
  };
}

export function toApiUserCreatePayload(draft: UserCreateDraft): ApiUserCreatePayload {
  return {
    fullName: draft.fullName.trim().replace(/\s+/g, ' '),
    email: draft.email.trim().toLowerCase(),
    role: draft.role,
    status: draft.status,
    password: draft.password,
    professionalSchoolId: draft.professionalSchoolId ?? 0,
  };
}

/** La contraseña solo viaja si se va a cambiar. */
export function toApiUserUpdatePayload(draft: UserUpdateDraft): ApiUserUpdatePayload {
  return {
    fullName: draft.fullName.trim().replace(/\s+/g, ' '),
    email: draft.email.trim().toLowerCase(),
    role: draft.role,
    status: draft.status,
    ...(draft.password ? { password: draft.password } : {}),
    ...(draft.professionalSchoolId !== null
      ? { professionalSchoolId: draft.professionalSchoolId }
      : {}),
  };
}
