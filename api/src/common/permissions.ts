import { PermissionLevel, UserRole } from '../generated/prisma/client';

/**
 * MODULOS Y PERMISOS DE DCREDITS.
 *
 * `name` es el identificador estable del modulo: coincide con la clave que usa
 * el frontend (ModuleKey) y con la columna `modules.name`.
 *
 * Los presets por rol son el punto de partida de cada usuario. Al crear una
 * cuenta se copian a `user_module_permissions`; a partir de ahi cada usuario
 * tiene su propia matriz y puede diferir del resto aunque comparta rol.
 */
export const MODULE_NAMES = [
  'dashboard',
  'calendar',
  'events',
  'students',
  'participations',
  'certificates',
  'verification',
  'users',
  'catalogs',
] as const;

export type ModuleName = (typeof MODULE_NAMES)[number];

export const ROLE_DEFAULT_PERMISSIONS: Record<
  UserRole,
  Record<ModuleName, PermissionLevel>
> = {
  ADMIN: {
    dashboard: PermissionLevel.VIEW,
    calendar: PermissionLevel.VIEW,
    events: PermissionLevel.MANAGE,
    students: PermissionLevel.MANAGE,
    participations: PermissionLevel.MANAGE,
    certificates: PermissionLevel.MANAGE,
    verification: PermissionLevel.VIEW,
    users: PermissionLevel.MANAGE,
    catalogs: PermissionLevel.MANAGE,
  },
  COORDINATOR: {
    dashboard: PermissionLevel.VIEW,
    calendar: PermissionLevel.VIEW,
    events: PermissionLevel.MANAGE,
    students: PermissionLevel.MANAGE,
    participations: PermissionLevel.MANAGE,
    certificates: PermissionLevel.MANAGE,
    verification: PermissionLevel.VIEW,
    users: PermissionLevel.NONE,
    catalogs: PermissionLevel.NONE,
  },
  ORGANIZER: {
    dashboard: PermissionLevel.VIEW,
    calendar: PermissionLevel.VIEW,
    events: PermissionLevel.MANAGE,
    students: PermissionLevel.VIEW,
    participations: PermissionLevel.MANAGE,
    certificates: PermissionLevel.MANAGE,
    verification: PermissionLevel.VIEW,
    users: PermissionLevel.NONE,
    catalogs: PermissionLevel.NONE,
  },
  OPERATOR: {
    dashboard: PermissionLevel.VIEW,
    calendar: PermissionLevel.VIEW,
    events: PermissionLevel.VIEW,
    students: PermissionLevel.VIEW,
    participations: PermissionLevel.MANAGE,
    certificates: PermissionLevel.NONE,
    verification: PermissionLevel.VIEW,
    users: PermissionLevel.NONE,
    catalogs: PermissionLevel.NONE,
  },
  VIEWER: {
    dashboard: PermissionLevel.VIEW,
    calendar: PermissionLevel.VIEW,
    events: PermissionLevel.VIEW,
    students: PermissionLevel.VIEW,
    participations: PermissionLevel.VIEW,
    certificates: PermissionLevel.NONE,
    verification: PermissionLevel.VIEW,
    users: PermissionLevel.NONE,
    catalogs: PermissionLevel.NONE,
  },
};

/**
 * Nivel por defecto de un rol en un modulo. Un modulo que no exista en el
 * preset (por ejemplo, uno nuevo agregado a la base) queda sin acceso.
 */
export function defaultPermission(role: UserRole, moduleName: string): PermissionLevel {
  const preset = ROLE_DEFAULT_PERMISSIONS[role] as Record<string, PermissionLevel> | undefined;
  return preset?.[moduleName] ?? PermissionLevel.NONE;
}
