export type UserRole = 'ADMIN' | 'COORDINATOR' | 'ORGANIZER' | 'OPERATOR' | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export const ALL_USER_ROLES: readonly UserRole[] = [
  'ADMIN',
  'COORDINATOR',
  'ORGANIZER',
  'OPERATOR',
  'VIEWER',
];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordinador académico',
  ORGANIZER: 'Organizador',
  OPERATOR: 'Operador de registro',
  VIEWER: 'Consulta',
};

/** Etiquetas cortas para tablas y columnas estrechas. */
export const ROLE_SHORT_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  COORDINATOR: 'Coord.',
  ORGANIZER: 'Organiz.',
  OPERATOR: 'Operador',
  VIEWER: 'Consulta',
};

/** Descripción de cada perfil; se usa como descripción por defecto del usuario. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Acceso completo, incluida la gestión de usuarios y perfiles.',
  COORDINATOR: 'Gestiona eventos, estudiantes, participaciones y códigos de certificado.',
  ORGANIZER: 'Organiza los eventos académicos de su escuela profesional.',
  OPERATOR: 'Registra participaciones e importa asistentes, sin administrar usuarios.',
  VIEWER: 'Consulta la información y verifica códigos sin modificar datos.',
};

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  initials: string;
  description: string;
}

/** Datos de un usuario tal como llegan desde el formulario de alta o edición. */
export interface UserDraft {
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

/** Longitud mínima de una contraseña de DCredits. */
export const MIN_PASSWORD_LENGTH = 8;

/** Alta: la contraseña inicial es obligatoria. */
export interface UserCreateDraft extends UserDraft {
  password: string;
}

/** Edición: la contraseña solo se envía cuando se va a cambiar. */
export interface UserUpdateDraft extends UserDraft {
  password?: string;
}

export interface UserValidation {
  valid: boolean;
  errors: {
    fullName?: string;
    email?: string;
    password?: string;
  };
}
