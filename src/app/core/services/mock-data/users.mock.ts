import { DemoUserAccount, UserProfile, UserRole } from '../../../models/user.model';

/**
 * Cuentas de acceso a DCredits.
 * Solo existe el usuario administrador por defecto.
 */
export const DEMO_USERS: readonly DemoUserAccount[] = [
  {
    id: 'user-admin',
    fullName: 'Administrador',
    email: 'admin@dcredits.com',
    password: 'admin123',
    role: 'ADMIN',
    status: 'ACTIVE',
    initials: 'AD',
    description: 'Acceso completo, incluida la gestión de usuarios y perfiles.',
  },
];

/** Descripción de cada perfil; se usa como descripción por defecto del usuario. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Acceso completo, incluida la gestión de usuarios y perfiles.',
  COORDINATOR: 'Gestiona eventos, estudiantes, participaciones y códigos de participación.',
  OPERATOR: 'Registra participaciones e importa asistentes, sin administrar usuarios.',
  VIEWER: 'Consulta la información y verifica códigos sin modificar datos.',
};

/** Iniciales de un nombre completo: primera letra de las dos primeras palabras. */
export function initialsOf(fullName: string): string {
  const parts = fullName.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** Directorio de usuarios. Solo contiene el usuario administrador. */
export const MOCK_USER_DIRECTORY: readonly UserProfile[] = DEMO_USERS.map((user) => ({ ...user }));
