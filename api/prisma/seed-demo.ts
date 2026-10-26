import { randomBytes, scryptSync } from 'node:crypto';

import {
  EventModality,
  EventStatus,
  EventType,
  ParticipationStatus,
  ParticipationType,
  StudentStatus,
  UserRole,
  UserStatus,
} from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';

/**
 * SEED DE DEMOSTRACION DE DCREDITS.
 *
 * Genera un conjunto de datos con el volumen de una prueba real:
 *  - 9 escuelas profesionales, 100 estudiantes de prueba en cada una (900),
 *  - 3 eventos academicos,
 *  - participaciones de esos estudiantes en los eventos,
 *  - usuarios: 1 organizador y 1 operador de registro por escuela, mas las 4
 *    cuentas de demostracion del frontend.
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada, porque cada
 * entidad se inserta con `createMany({ skipDuplicates: true })` sobre su clave
 * funcional (codigo de estudiante, codigo de evento, correo, evento+estudiante)
 * y los codigos de participacion se derivan de forma determinista.
 *
 * NO borra datos existentes.
 *
 * La contrasena de las cuentas de escuela es temporal ("uroosevelt") y se
 * guarda como hash scrypt: nunca en claro. `mustChangePassword` queda en true
 * para que el futuro cambio de contrasena obligatorio tenga de donde partir.
 */

const prisma = createPrismaClient();

// ---------------------------------------------------------------------------
// DATOS BASE
// ---------------------------------------------------------------------------

/** Escuelas profesionales de la prueba. */
const SCHOOLS = [
  'ADMINISTRACION Y NEGOCIOS INTERNACIONALES',
  'FARMACIA',
  'ENFERMERIA',
  'ESTOMATOLOGIA',
  'OBSTETRICIA',
  'PSICOLOGIA',
  'ADMINISTRACION DE EMPRESAS',
  'MEDICINA HUMANA',
  'DERECHO',
];

/** Sedes del padron. Se reutilizan las del frontend para que los filtros casen. */
const HEADQUARTERS = ['SEDE CENTRAL', 'FILIAL LIMA', 'FILIAL AREQUIPA', 'FILIAL TRUJILLO'];

const ACADEMIC_DEGREES = ['PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO', 'SEXTO'];

const FIRST_NAMES = [
  'MARIA', 'JUAN', 'ANA', 'LUIS', 'CARLA', 'DIEGO', 'SOFIA', 'MATEO', 'ELENA', 'PABLO',
  'LUCIA', 'ANDRES', 'VALERIA', 'RICARDO', 'CAMILA', 'JORGE', 'MARIANA', 'FERNANDO',
  'ISABEL', 'RODRIGO', 'PAULA', 'HECTOR', 'GABRIELA', 'ADRIAN', 'CLAUDIA', 'EMILIO',
  'NATALIA', 'TOMAS', 'PATRICIA', 'OSCAR',
];

const LAST_NAMES = [
  'GARCIA', 'RODRIGUEZ', 'LOPEZ', 'MARTINEZ', 'HERNANDEZ', 'GONZALEZ', 'PEREZ', 'SANCHEZ',
  'RAMIREZ', 'TORRES', 'FLORES', 'RIVERA', 'GOMEZ', 'DIAZ', 'CRUZ', 'MORALES', 'REYES',
  'GUTIERREZ', 'CHAVEZ', 'RUIZ', 'ALVAREZ', 'MENDOZA', 'VARGAS', 'CASTILLO', 'ROMERO',
  'SUAREZ', 'RAMOS', 'ORTEGA', 'DELGADO', 'ACOSTA', 'MEDINA', 'HERRERA', 'AGUILAR', 'VEGA',
];

const STUDENTS_PER_SCHOOL = 100;
const SCHOOL_PASSWORD = 'uroosevelt';
const CODE_YEAR = 2026;

// ---------------------------------------------------------------------------
// UTILIDADES
// ---------------------------------------------------------------------------

function pad(value: number, size: number): string {
  return String(value).padStart(size, '0');
}

/** Nombre completo determinista a partir de un indice. */
function personName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const second = FIRST_NAMES[(index * 3 + 5) % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7 + 1) % LAST_NAMES.length];
  const last2 = LAST_NAMES[(index * 11 + 4) % LAST_NAMES.length];
  return `${last} ${last2}, ${first} ${second}`;
}

/** Nombre para mostrarlo como persona (orden natural). */
function displayName(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index * 7 + 1) % LAST_NAMES.length];
  const last2 = LAST_NAMES[(index * 11 + 4) % LAST_NAMES.length];
  return `${first} ${last} ${last2}`;
}

/** Parte de correo institucional a partir del nombre de la escuela. */
function schoolSlug(school: string): string {
  return school
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/** Hash scrypt con sal por usuario. Formato: scrypt$<salHex>$<hashHex>. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

// PRNG determinista para que los codigos no cambien entre ejecuciones.
function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Codigo de participacion determinista: el mismo par evento+estudiante produce
 * siempre el mismo codigo, para que repetir el seed no cambie el historico.
 */
function verificationCode(eventCode: string, universityCode: string, attempt = 0): string {
  const seed = xmur3(`${eventCode}:${universityCode}:${attempt}`);
  const rand = mulberry32(seed());
  let body = '';
  for (let i = 0; i < 6; i++) {
    body += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  }
  return `DC-${CODE_YEAR}-${body}`;
}

// ---------------------------------------------------------------------------
// CONSTRUCCION DE DATOS
// ---------------------------------------------------------------------------

interface SchoolUser {
  school: string;
  organizer: { fullName: string; email: string };
  operator: { fullName: string; email: string };
}

function buildSchoolUsers(): SchoolUser[] {
  return SCHOOLS.map((school, index) => {
    const slug = schoolSlug(school);
    return {
      school,
      organizer: {
        fullName: displayName(index * 2 + 3),
        email: `organizador.${slug}@uroosevelt.edu.pe`,
      },
      operator: {
        fullName: displayName(index * 2 + 4),
        email: `operador.${slug}@uroosevelt.edu.pe`,
      },
    };
  });
}

function buildStudents() {
  const rows: {
    universityCode: string;
    academicDegree: string;
    lastName: string;
    firstName: string;
    professionalSchool: string;
    headquarters: string;
    status: StudentStatus;
  }[] = [];

  SCHOOLS.forEach((school, schoolIndex) => {
    for (let j = 1; j <= STUDENTS_PER_SCHOOL; j++) {
      const nameSeed = schoolIndex * STUDENTS_PER_SCHOOL + j;
      const full = personName(nameSeed);
      const commaAt = full.indexOf(',');
      const lastName = full.slice(0, commaAt).trim();
      const firstName = full.slice(commaAt + 1).trim();

      rows.push({
        // 23 + escuela (1 digito) + correlativo (4 digitos) = 7 digitos.
        universityCode: `23${schoolIndex + 1}${pad(j, 4)}`,
        academicDegree: j % 3 === 0 ? '' : ACADEMIC_DEGREES[j % ACADEMIC_DEGREES.length],
        lastName,
        firstName,
        professionalSchool: school,
        headquarters: HEADQUARTERS[j % HEADQUARTERS.length],
        status: (schoolIndex + j) % 11 === 0 ? StudentStatus.INACTIVE : StudentStatus.ACTIVE,
      });
    }
  });

  return rows;
}

function buildEvents(schoolUsers: SchoolUser[]) {
  const organizerOf = (school: string): string =>
    schoolUsers.find((entry) => entry.school === school)?.organizer.fullName ?? '';

  return [
    {
      code: 'EVT-2026-101',
      name: 'Congreso Internacional de Salud Publica',
      description:
        'Congreso academico de tres dias sobre salud publica, investigacion e innovacion.',
      eventType: EventType.MULTI_DAY,
      category: 'Congreso',
      startDate: new Date('2026-10-05T00:00:00.000Z'),
      endDate: new Date('2026-10-07T00:00:00.000Z'),
      startTime: '08:30',
      endTime: '18:00',
      modality: EventModality.HYBRID,
      location: 'Auditorio Central, Sede Central',
      capacity: 900,
      organizer: organizerOf('MEDICINA HUMANA'),
      credits: 2,
      status: EventStatus.IN_PROGRESS,
    },
    {
      code: 'EVT-2026-102',
      name: 'Taller de Metodologia de la Investigacion',
      description: 'Taller practico sobre formulacion de proyectos y redaccion cientifica.',
      eventType: EventType.SINGLE_DAY,
      category: 'Taller',
      startDate: new Date('2026-09-15T00:00:00.000Z'),
      endDate: new Date('2026-09-15T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '13:00',
      modality: EventModality.PRESENTIAL,
      location: 'Aula Magna, Sede Central',
      capacity: 300,
      organizer: organizerOf('PSICOLOGIA'),
      credits: 1,
      status: EventStatus.SCHEDULED,
    },
    {
      code: 'EVT-2026-103',
      name: 'Seminario de Innovacion y Emprendimiento',
      description:
        'Seminario virtual sobre innovacion, emprendimiento y transferencia de conocimiento.',
      eventType: EventType.SINGLE_DAY,
      category: 'Seminario',
      startDate: new Date('2026-07-20T00:00:00.000Z'),
      endDate: new Date('2026-07-20T00:00:00.000Z'),
      startTime: '16:00',
      endTime: '19:00',
      modality: EventModality.VIRTUAL,
      location: 'Plataforma virtual institucional',
      capacity: null,
      organizer: organizerOf('ADMINISTRACION DE EMPRESAS'),
      credits: 1.5,
      status: EventStatus.COMPLETED,
    },
  ];
}

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const schoolUsers = buildSchoolUsers();
  const students = buildStudents();
  const events = buildEvents(schoolUsers);

  // --- Usuarios -------------------------------------------------------------
  // Las 4 cuentas de demostracion del frontend se conservan para el login.
  const demoUsers = [
    {
      fullName: 'Ana Torres',
      email: 'admin@dcredits.demo',
      password: 'admin123',
      role: UserRole.ADMIN,
      professionalSchool: '',
    },
    {
      fullName: 'Luis Ramirez',
      email: 'coordinacion@dcredits.demo',
      password: 'coordinacion123',
      role: UserRole.COORDINATOR,
      professionalSchool: '',
    },
    {
      fullName: 'Carla Mendez',
      email: 'operador@dcredits.demo',
      password: 'operador123',
      role: UserRole.OPERATOR,
      professionalSchool: '',
    },
    {
      fullName: 'Diego Salas',
      email: 'consulta@dcredits.demo',
      password: 'consulta123',
      role: UserRole.VIEWER,
      professionalSchool: '',
    },
  ];

  const userRows = [
    ...demoUsers.map((user) => ({
      fullName: user.fullName,
      email: user.email,
      passwordHash: hashPassword(user.password),
      mustChangePassword: false,
      role: user.role,
      status: UserStatus.ACTIVE,
      professionalSchool: user.professionalSchool,
    })),
    ...schoolUsers.flatMap((entry) => [
      {
        fullName: entry.organizer.fullName,
        email: entry.organizer.email,
        passwordHash: hashPassword(SCHOOL_PASSWORD),
        mustChangePassword: true,
        role: UserRole.ORGANIZER,
        status: UserStatus.ACTIVE,
        professionalSchool: entry.school,
      },
      {
        fullName: entry.operator.fullName,
        email: entry.operator.email,
        passwordHash: hashPassword(SCHOOL_PASSWORD),
        mustChangePassword: true,
        role: UserRole.OPERATOR,
        status: UserStatus.ACTIVE,
        professionalSchool: entry.school,
      },
    ]),
  ];

  const usersCreated = await prisma.user.createMany({
    data: userRows,
    skipDuplicates: true,
  });

  // --- Estudiantes ----------------------------------------------------------
  const studentsCreated = await prisma.student.createMany({
    data: students,
    skipDuplicates: true,
  });

  const storedStudents = await prisma.student.findMany({
    where: { universityCode: { in: students.map((student) => student.universityCode) } },
    select: { id: true, universityCode: true },
  });
  const studentIdByCode = new Map(storedStudents.map((row) => [row.universityCode, row.id]));

  // --- Eventos --------------------------------------------------------------
  const eventsCreated = await prisma.event.createMany({
    data: events,
    skipDuplicates: true,
  });

  const storedEvents = await prisma.event.findMany({
    where: { code: { in: events.map((event) => event.code) } },
    select: { id: true, code: true, startDate: true, credits: true },
  });
  const eventByCode = new Map(storedEvents.map((row) => [row.code, row]));

  // --- Participaciones ------------------------------------------------------
  const participationRows: {
    eventId: string;
    studentId: string;
    participationType: ParticipationType;
    participationDate: Date;
    credits: number;
    verificationCode: string;
    grade: number | null;
    status: ParticipationStatus;
  }[] = [];

  const usedCodes = new Set<string>();
  let pendingSeq = 0;

  const addParticipation = (
    eventCode: string,
    universityCode: string,
    sequence: number
  ): void => {
    const event = eventByCode.get(eventCode);
    const studentId = studentIdByCode.get(universityCode);
    if (!event || !studentId) {
      return;
    }

    let code = verificationCode(eventCode, universityCode, pendingSeq);
    let attempt = 0;
    while (usedCodes.has(code)) {
      attempt += 1;
      code = verificationCode(eventCode, universityCode, pendingSeq + attempt);
    }
    usedCodes.add(code);
    pendingSeq += 1;

    const status =
      sequence % 37 === 0
        ? ParticipationStatus.PENDING
        : sequence % 53 === 0
          ? ParticipationStatus.CANCELLED
          : ParticipationStatus.VALID;

    const start = event.startDate;
    const participationDate = new Date(start.getTime() + (8 + (sequence % 6)) * 3600000);

    participationRows.push({
      eventId: event.id,
      studentId,
      participationType: sequence % 61 === 0 ? ParticipationType.PONENTE : ParticipationType.ASISTENTE,
      participationDate,
      credits: event.credits,
      verificationCode: code,
      grade: status === ParticipationStatus.VALID && sequence % 4 !== 0 ? 18 - (sequence % 5) : null,
      status,
    });
  };

  // Evento 1: todos los estudiantes.
  // Evento 2: 8 de cada 10 estudiantes.
  // Evento 3: la mitad de cada escuela.
  let sequence = 0;
  students.forEach((student, index) => {
    addParticipation('EVT-2026-101', student.universityCode, (sequence += 1));
    if (index % 5 !== 4) {
      addParticipation('EVT-2026-102', student.universityCode, (sequence += 1));
    }
    if (index % 2 === 0) {
      addParticipation('EVT-2026-103', student.universityCode, (sequence += 1));
    }
  });

  const participationsCreated = await prisma.participation.createMany({
    data: participationRows,
    skipDuplicates: true,
  });

  // --- Resumen --------------------------------------------------------------
  const totals = {
    usuarios: await prisma.user.count(),
    estudiantes: await prisma.student.count(),
    eventos: await prisma.event.count(),
    participaciones: await prisma.participation.count(),
  };

  console.log('Seed de demostracion de DCredits completado:');
  console.log(`  escuelas          : ${SCHOOLS.length}`);
  console.log(`  estudiantes/escuela: ${STUDENTS_PER_SCHOOL}`);
  console.log(`  usuarios insertados: ${usersCreated.count}`);
  console.log(`  estudiantes insertados: ${studentsCreated.count}`);
  console.log(`  eventos insertados : ${eventsCreated.count}`);
  console.log(`  participaciones insertadas: ${participationsCreated.count}`);
  console.log('Totales en la base:');
  console.log(`  usuarios          : ${totals.usuarios}`);
  console.log(`  estudiantes       : ${totals.estudiantes}`);
  console.log(`  eventos           : ${totals.eventos}`);
  console.log(`  participaciones   : ${totals.participaciones}`);
  console.log('');
  console.log('Usuarios por escuela (contrasena temporal: ' + SCHOOL_PASSWORD + '):');
  for (const entry of schoolUsers) {
    console.log(`  ${entry.school}`);
    console.log(`    organizador: ${entry.organizer.email}`);
    console.log(`    operador   : ${entry.operator.email}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed de demostracion fallido:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
