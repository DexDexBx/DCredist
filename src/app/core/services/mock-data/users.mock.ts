import { DemoUserAccount, UserProfile, UserRole, UserStatus } from '../../../models/user.model';

/**
 * Cuentas de demostración de DCredits.
 *
 * Son datos mock: no existe backend ni autenticación real. Las 4 cuentas de
 * arranque sí traen contraseña para poder entrar desde /signin con cada perfil.
 */
export const DEMO_USERS: readonly DemoUserAccount[] = [
  {
    id: 'user-admin',
    fullName: 'Ana Torres',
    email: 'admin@dcredits.demo',
    password: 'admin123',
    role: 'ADMIN',
    status: 'ACTIVE',
    initials: 'AT',
    description: 'Acceso completo, incluida la gestión de usuarios y perfiles.',
  },
  {
    id: 'user-coordinator',
    fullName: 'Luis Ramírez',
    email: 'coordinacion@dcredits.demo',
    password: 'coordinacion123',
    role: 'COORDINATOR',
    status: 'ACTIVE',
    initials: 'LR',
    description:
      'Gestiona eventos, estudiantes, participaciones y códigos de certificado.',
  },
  {
    id: 'user-operator',
    fullName: 'Carla Méndez',
    email: 'operador@dcredits.demo',
    password: 'operador123',
    role: 'OPERATOR',
    status: 'ACTIVE',
    initials: 'CM',
    description:
      'Registra participaciones e importa asistentes, sin administrar usuarios.',
  },
  {
    id: 'user-viewer',
    fullName: 'Diego Salas',
    email: 'consulta@dcredits.demo',
    password: 'consulta123',
    role: 'VIEWER',
    status: 'ACTIVE',
    initials: 'DS',
    description: 'Consulta la información y verifica códigos sin modificar datos.',
  },
];

const FIRST_NAMES = [
  'María', 'Juan', 'Ana', 'Luis', 'Carla', 'Diego', 'Sofía', 'Mateo', 'Elena', 'Pablo',
  'Lucía', 'Andrés', 'Valeria', 'Ricardo', 'Camila', 'Jorge', 'Mariana', 'Fernando',
  'Isabel', 'Rodrigo', 'Paula', 'Héctor', 'Gabriela', 'Adrián', 'Claudia', 'Emilio',
  'Natalia', 'Tomás', 'Patricia', 'Óscar', 'Renata', 'Iván', 'Daniela', 'Miguel', 'Beatriz',
];

const LAST_NAMES = [
  'García', 'Rodríguez', 'López', 'Martínez', 'Hernández', 'González', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes',
  'Gutiérrez', 'Chávez', 'Ruiz', 'Alvarez', 'Mendoza', 'Vargas', 'Castillo', 'Romero',
  'Suárez', 'Ramos', 'Ortega', 'Delgado', 'Acosta', 'Medina', 'Herrera', 'Aguilar', 'Vega',
];

/** Descripción de cada perfil; se usa como descripción por defecto del usuario. */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Acceso completo, incluida la gestión de usuarios y perfiles.',
  COORDINATOR: 'Gestiona eventos, estudiantes, participaciones y códigos de certificado.',
  OPERATOR: 'Registra participaciones e importa asistentes, sin administrar usuarios.',
  VIEWER: 'Consulta la información y verifica códigos sin modificar datos.',
};

/** Reparte los ~96 usuarios extra entre los 4 perfiles, con más operadores y consulta. */
const ROLE_PLAN: UserRole[] = [
  ...Array<UserRole>(3).fill('ADMIN'),
  ...Array<UserRole>(19).fill('COORDINATOR'),
  ...Array<UserRole>(40).fill('OPERATOR'),
  ...Array<UserRole>(34).fill('VIEWER'),
];

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Iniciales de un nombre completo: primera letra de las dos primeras palabras. */
export function initialsOf(fullName: string): string {
  const parts = fullName.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** ~1 de cada 8 usuarios queda inactivo, para poder ver y filtrar ese estado. */
function statusFor(index: number): UserStatus {
  return index % 8 === 3 ? 'INACTIVE' : 'ACTIVE';
}

/**
 * Directorio mock de usuarios: las 4 cuentas de arranque + ~96 registros sin
 * contraseña. En total ~100 usuarios, para que la pantalla de /users se vea
 * con el volumen real que tendrá cuando exista la API. Ninguno de los extra
 * puede iniciar sesión: son solo registros del directorio.
 */
export const MOCK_USER_DIRECTORY: readonly UserProfile[] = (() => {
  const directory: UserProfile[] = DEMO_USERS.map((user) => ({ ...user }));
  const roles = [...ROLE_PLAN];

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const fullName = `${FIRST_NAMES[index % FIRST_NAMES.length]} ${
      LAST_NAMES[index % LAST_NAMES.length]
    } ${LAST_NAMES[(index * 7 + 3) % LAST_NAMES.length]}`;
    const base = stripAccents(fullName)
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()
      .replace(/\s+/g, '.');
    const sequential = index + 1;

    directory.push({
      id: `user-dir-${sequential}`,
      fullName,
      email: `${base}${sequential}@dcredits.demo`,
      role,
      status: statusFor(sequential),
      initials: initialsOf(fullName),
      description: ROLE_DESCRIPTIONS[role],
    });
  }

  return directory;
})();
