import { UserRole } from './user.model';

/**
 * Nivel de acceso a un modulo.
 *
 *  - NONE:   no puede abrir el modulo ni verlo en el menu.
 *  - VIEW:   solo consulta: puede abrir el modulo, pero no aparecen acciones
 *            de alta, edicion ni importacion.
 *  - MANAGE: gestion completo: crea, edita e importa.
 */
export type PermissionLevel = 'NONE' | 'VIEW' | 'MANAGE';

export type ModuleKey =
  | 'dashboard'
  | 'calendar'
  | 'events'
  | 'students'
  | 'participations'
  | 'certificates'
  | 'verification'
  | 'users'
  | 'catalogs';

export interface ModuleDefinition {
  key: ModuleKey;
  label: string;
  description: string;
}

export const MODULES: readonly ModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Indicadores de participación y créditos.' },
  { key: 'calendar', label: 'Calendario', description: 'Calendario de eventos académicos.' },
  { key: 'events', label: 'Eventos', description: 'Alta, edición y detalle de eventos.' },
  { key: 'students', label: 'Estudiantes', description: 'Padrón e importación de estudiantes.' },
  { key: 'participations', label: 'Participaciones', description: 'Registro de participaciones.' },
  { key: 'certificates', label: 'Códigos de certificado', description: 'Códigos de certificado.' },
  { key: 'verification', label: 'Verificación', description: 'Consulta del código de participación.' },
  { key: 'users', label: 'Usuarios y perfiles', description: 'Perfiles y accesos del sistema.' },
  { key: 'catalogs', label: 'Catálogos', description: 'Organizadores, escuelas y sedes.' },
];

export const PERMISSION_LEVEL_LABEL: Record<PermissionLevel, string> = {
  NONE: 'Sin acceso',
  VIEW: 'Solo ver',
  MANAGE: 'Gestionar',
};

const LEVEL_RANK: Record<PermissionLevel, number> = {
  NONE: 0,
  VIEW: 1,
  MANAGE: 2,
};

export function permissionAtLeast(
  level: PermissionLevel,
  required: PermissionLevel,
): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[required];
}

export type PermissionMap = Record<ModuleKey, PermissionLevel>;

/**
 * Acceso minimo por defecto de cada perfil. El administrador puede ajustarlos
 * por usuario desde el modulo de usuarios (ver AuthService.setPermission).
 */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionMap> = {
  ADMIN: {
    dashboard: 'VIEW',
    calendar: 'VIEW',
    events: 'MANAGE',
    students: 'MANAGE',
    participations: 'MANAGE',
    certificates: 'MANAGE',
    verification: 'VIEW',
    users: 'MANAGE',
    catalogs: 'MANAGE',
  },
  COORDINATOR: {
    dashboard: 'VIEW',
    calendar: 'VIEW',
    events: 'MANAGE',
    students: 'MANAGE',
    participations: 'MANAGE',
    certificates: 'MANAGE',
    verification: 'VIEW',
    users: 'NONE',
    catalogs: 'NONE',
  },
  OPERATOR: {
    dashboard: 'VIEW',
    calendar: 'VIEW',
    events: 'VIEW',
    students: 'VIEW',
    participations: 'MANAGE',
    certificates: 'NONE',
    verification: 'VIEW',
    users: 'NONE',
    catalogs: 'NONE',
  },
  VIEWER: {
    dashboard: 'VIEW',
    calendar: 'VIEW',
    events: 'VIEW',
    students: 'VIEW',
    participations: 'VIEW',
    certificates: 'NONE',
    verification: 'VIEW',
    users: 'NONE',
    catalogs: 'NONE',
  },
};
