import {
  AcademicEvent,
  EVENT_TYPES,
  EventDraft,
  EventModality,
  EventStatus,
  EventType,
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
  ApiEvent,
  ApiEventModality,
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
};

const MODALITY_TO_API: Record<EventModality, ApiEventModality> = {
  Presencial: 'PRESENTIAL',
  Virtual: 'VIRTUAL',
  Híbrido: 'HYBRID',
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

/** La categoria academica del API es el "tipo" de evento del frontend. */
function categoryToEventType(category: string): EventType {
  return (EVENT_TYPES as readonly string[]).includes(category)
    ? (category as EventType)
    : 'Congreso';
}

export function mapApiStudent(row: ApiStudent): Student {
  return {
    id: row.id,
    universityCode: row.universityCode,
    academicDegree: row.academicDegree,
    lastName: row.lastName,
    firstName: row.firstName,
    professionalSchool: row.professionalSchool,
    headquarters: row.headquarters,
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
    initials: initialsOf(row.fullName),
    description: ROLE_DESCRIPTIONS[row.role],
    permissions: null,
    permissionsOverridden: row.permissionsOverridden ?? 0,
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

export function mapApiEvent(row: ApiEvent): AcademicEvent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    eventType: categoryToEventType(row.category),
    startDate: toIso(row.startDate),
    endDate: toIso(row.endDate),
    modality: MODALITY_FROM_API[row.modality] ?? 'Presencial',
    location: row.location,
    status: STATUS_FROM_API[row.status] ?? 'Programado',
    capacity: row.capacity,
    organizer: row.organizer,
    credits: row.credits,
    tags: [],
  };
}

export function mapApiParticipation(row: ApiParticipation): Participation {
  return {
    id: row.id,
    eventId: row.eventId,
    studentId: row.studentId,
    participationType: row.participationType,
    participationDate: toIso(row.participationDate),
    credits: row.credits,
    verificationCode: row.verificationCode,
    legacyCode: null,
    grade: row.grade,
    status: row.status,
  };
}

export function toApiEventPayload(draft: EventDraft): ApiEventPayload {
  return {
    ...(draft.code?.trim() ? { code: draft.code.trim() } : {}),
    name: draft.name.trim(),
    description: draft.description.trim(),
    category: draft.eventType,
    startDate: toIso(draft.startDate),
    endDate: toIso(draft.endDate),
    modality: MODALITY_TO_API[draft.modality],
    location: draft.location.trim(),
    capacity: draft.capacity,
    organizer: draft.organizer.trim(),
    credits: draft.credits,
    status: STATUS_TO_API[draft.status],
  };
}

export function toApiStudentPayload(draft: StudentDraft): ApiStudentPayload {
  return {
    universityCode: draft.universityCode.trim(),
    academicDegree: draft.academicDegree.trim(),
    lastName: draft.lastName.trim(),
    firstName: draft.firstName.trim(),
    professionalSchool: draft.professionalSchool.trim(),
    headquarters: draft.headquarters.trim(),
    status: draft.status,
  };
}

export function toApiStudentImportRows(rows: StudentImportRow[]): ApiStudentImportRow[] {
  return rows.map((row) => ({
    universityCode: row.universityCode.trim(),
    academicDegree: row.academicDegree?.trim() || undefined,
    lastName: row.lastName?.trim() || undefined,
    firstName: row.firstName?.trim() || undefined,
    professionalSchool: row.professionalSchool?.trim() || undefined,
    headquarters: row.headquarters?.trim() || undefined,
  }));
}

export function toApiParticipationPayload(draft: ParticipationDraft): ApiParticipationPayload {
  return {
    eventId: draft.eventId,
    studentId: draft.studentId,
    participationType: draft.participationType,
    credits: draft.credits,
    grade: draft.grade ?? null,
  };
}

export function toApiUserCreatePayload(draft: UserCreateDraft): ApiUserCreatePayload {
  return {
    fullName: draft.fullName.trim().replace(/\s+/g, ' '),
    email: draft.email.trim().toLowerCase(),
    role: draft.role,
    status: draft.status,
    password: draft.password,
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
  };
}
