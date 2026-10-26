export type UserRole = 'ADMIN' | 'COORDINATOR' | 'OPERATOR' | 'VIEWER';

export type UserStatus = 'ACTIVE' | 'INACTIVE';

export const ALL_USER_ROLES: readonly UserRole[] = ['ADMIN', 'COORDINATOR', 'OPERATOR', 'VIEWER'];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordinador académico',
  OPERATOR: 'Operador de registro',
  VIEWER: 'Consulta',
};

/** Etiquetas cortas para tablas y columnas estrechas. */
export const ROLE_SHORT_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  COORDINATOR: 'Coord.',
  OPERATOR: 'Operador',
  VIEWER: 'Consulta',
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

export interface UserValidation {
  valid: boolean;
  errors: {
    fullName?: string;
    email?: string;
  };
}

/**
 * Cuenta de demostración con credencial. La contraseña vive solo en el frontend
 * mientras la API de DCredits no esté disponible; nunca representa una credencial
 * real. Solo las 4 cuentas de arranque la traen: los usuarios del directorio son
 * registros mock sin contraseña.
 */
export interface DemoUserAccount extends UserProfile {
  password?: string;
}
