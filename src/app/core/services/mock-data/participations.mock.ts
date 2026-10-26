import {
  AcademicEvent,
  Participation,
  ParticipationStatus,
  ParticipationType,
  Student,
} from '../../../models';

/**
 * MOCK DATA - PARTICIPACIONES.
 *
 * Une ESTUDIANTE <-> EVENTO. Es el unico lugar donde viven los creditos, la
 * nota y los codigos: el vigente de DCredits y, en lo historico migrado, el
 * que emitia el sistema anterior.
 *
 * Incluye a proposito:
 *  - notas vacias (null) que NO deben convertirse en 0,
 *  - participaciones CANCELLED que no deben sumar creditos,
 *  - participaciones PENDING,
 *  - varias escuelas profesionales y tipos de participacion,
 *  - un estudiante que supera la meta de creditos,
 *  - certificados HISTORICOS migrados: con el codigo del sistema anterior y,
 *    en parte de ellos, con el codigo DC ya asignado encima.
 */

/**
 * De que nomenclatura viene el codigo de la participacion.
 *
 *  - DC: solo codigo DCredits (todo lo que se registra desde la puesta en marcha).
 *  - LEGACY: certificado historico reingresado que AUN no tiene codigo DC.
 *  - BOTH: certificado historico al que DCredits ya le asigno su codigo DC.
 */
type SeedCodeOrigin = 'DC' | 'LEGACY' | 'BOTH';

interface ParticipationSeed {
  /** Codigo universitario del padron. */
  universityCode: string;
  eventId: string;
  participationType: ParticipationType;
  /** Si se omite, se hereda el credito del evento. */
  credits?: number;
  grade: number | null;
  status: ParticipationStatus;
  /** Por omision, DC. */
  origin?: SeedCodeOrigin;
  /** Codigo del sistema anterior, tal como se reimprime. */
  legacyCode?: string;
}

const PARTICIPATION_SEEDS: ParticipationSeed[] = [
  // evt-002 - Seminario de Investigacion Cientifica (1.5 creditos, finalizado)
  // Evento del periodo migrado desde el sistema anterior: sus certificados ya
  // estaban emitidos, por lo que conviven las tres nomenclaturas.
  {
    universityCode: '2213271',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: 16,
    status: 'VALID',
    origin: 'LEGACY',
    legacyCode: 'SIS/2019/008821',
  },
  {
    universityCode: '2213065',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: 17,
    status: 'VALID',
    origin: 'BOTH',
    legacyCode: 'SIS-2019-0142',
  },
  {
    universityCode: '2213099',
    eventId: 'evt-002',
    participationType: 'PONENTE',
    grade: 18,
    status: 'VALID',
    origin: 'LEGACY',
    legacyCode: 'CERT 2020/00457',
  },
  {
    universityCode: '2214410',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: 14,
    status: 'VALID',
    origin: 'BOTH',
    legacyCode: 'EP-2018-0142-B',
  },
  {
    universityCode: '2220699',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
    origin: 'LEGACY',
    legacyCode: 'SIS/2020/011904',
  },
  {
    universityCode: '2228487',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: 15,
    status: 'VALID',
  },
  {
    universityCode: '2217366',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2215522',
    eventId: 'evt-002',
    participationType: 'ASISTENTE',
    grade: 19,
    status: 'VALID',
  },

  // evt-001 - Congreso Internacional (2 creditos, finalizado)
  {
    // Participacion anulada: sus 2 creditos NO se suman al historico del estudiante.
    universityCode: '2213271',
    eventId: 'evt-001',
    participationType: 'ASISTENTE',
    grade: 15,
    status: 'CANCELLED',
  },
  {
    universityCode: '2213099',
    eventId: 'evt-001',
    participationType: 'ASISTENTE',
    grade: 17,
    status: 'VALID',
  },
  {
    universityCode: '2215733',
    eventId: 'evt-001',
    participationType: 'ASISTENTE',
    grade: 16,
    status: 'VALID',
  },
  {
    universityCode: '2216044',
    eventId: 'evt-001',
    participationType: 'PONENTE',
    grade: 18,
    status: 'VALID',
  },
  {
    universityCode: '2222821',
    eventId: 'evt-001',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },

  // evt-003 - Taller de Integridad Academica (1 credito, finalizado)
  {
    universityCode: '2213271',
    eventId: 'evt-003',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2213065',
    eventId: 'evt-003',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2215522',
    eventId: 'evt-003',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2216155',
    eventId: 'evt-003',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2218477',
    eventId: 'evt-003',
    participationType: 'ORGANIZADOR',
    grade: null,
    status: 'VALID',
    origin: 'LEGACY',
    legacyCode: 'SIS/2021/002310',
  },
  {
    universityCode: '2224043',
    eventId: 'evt-003',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },

  // evt-004 - Foro de Innovacion Docente (2 creditos, en curso, varios dias)
  {
    universityCode: '2213271',
    eventId: 'evt-004',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2214410',
    eventId: 'evt-004',
    participationType: 'PANELISTA',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2217366',
    eventId: 'evt-004',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2219588',
    eventId: 'evt-004',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2221710',
    eventId: 'evt-004',
    participationType: 'PONENTE',
    grade: null,
    status: 'VALID',
  },
  {
    universityCode: '2227376',
    eventId: 'evt-004',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'VALID',
  },

  // evt-005 - Encuentro de Salud Estudiantil (1 credito, programado)
  {
    universityCode: '2213065',
    eventId: 'evt-005',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
  {
    universityCode: '2213099',
    eventId: 'evt-005',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
  {
    universityCode: '2225154',
    eventId: 'evt-005',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
  {
    universityCode: '2226265',
    eventId: 'evt-005',
    participationType: 'INVITADO',
    grade: null,
    status: 'PENDING',
  },

  // evt-006 - Webinar (1 credito, programado)
  {
    universityCode: '2215522',
    eventId: 'evt-006',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
  {
    universityCode: '2216044',
    eventId: 'evt-006',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },

  // evt-007 - Curso de Actualizacion (3 creditos, programado, varios dias)
  {
    universityCode: '2213099',
    eventId: 'evt-007',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
  {
    universityCode: '2215733',
    eventId: 'evt-007',
    participationType: 'ASISTENTE',
    grade: null,
    status: 'PENDING',
  },
];

const CODE_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_YEAR = 2026;

/**
 * Codigo determinista (p. ej. DC-2026-8F4K2P) para que la pantalla de
 * verificacion tenga ejemplos estables durante el desarrollo.
 * En el backend el codigo se genera en el servidor con constraint UNIQUE.
 */
function deterministicVerificationCode(seed: string): string {
  let hash = 2_166_136_261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }

  let body = '';
  let state = Math.abs(hash) || 1;
  for (let i = 0; i < 6; i++) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    body += CODE_ALPHABET[state % CODE_ALPHABET.length];
  }
  return `DC-${CODE_YEAR}-${body}`;
}

/**
 * PARTICIPACIONES HISTORICAS DEL PADRON GENERADO.
 *
 * Los 20 casos de arriba cubren las tres nomenclaturas de codigo; esto cubre el
 * resto del padron. Sin participaciones, el corte de acreditacion mostraria
 * "0 completaron la meta" sobre 260 000 estudiantes, que no es informacion: es un
 * mock a medio hacer.
 *
 * DISTRIBUCION: cada estudiante recibe un perfil de carrera y participa en los
 * eventos finalizados hasta acumular los creditos de ese perfil. Como los
 * eventos se recorren del mas antiguo al mas reciente, el historial queda en
 * orden cronologico, como en la vida real.
 *
 *  - `GRADUADO`   : alcanza y supera la meta.
 *  - `AVANZADO`   : le queda poco.
 *  - `INTERMEDIO` : tiene historia, le falta bastante.
 *  - `INICIAL`    : solo lo justo para tener un avance visible.
 *  - `SIN_HISTORIAL`: no ha participado nunca.
 */
type CareerProfile = 'GRADUADO' | 'AVANZADO' | 'INTERMEDIO' | 'INICIAL' | 'SIN_HISTORIAL';

const CAREER_PROFILES: { profile: CareerProfile; weight: number }[] = [
  { profile: 'GRADUADO', weight: 14 },
  { profile: 'AVANZADO', weight: 18 },
  { profile: 'INTERMEDIO', weight: 26 },
  { profile: 'INICIAL', weight: 14 },
  { profile: 'SIN_HISTORIAL', weight: 28 },
];

const TOTAL_WEIGHT = CAREER_PROFILES.reduce((total, item) => total + item.weight, 0);

function pickProfile(random: () => number): CareerProfile {
  let cursor = random() * TOTAL_WEIGHT;

  for (const item of CAREER_PROFILES) {
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.profile;
    }
  }

  return 'SIN_HISTORIAL';
}

/** Creditos que el perfil pretende tener. La meta se mide contra 21. */
function targetCreditsOf(profile: CareerProfile, random: () => number): number {
  switch (profile) {
    case 'GRADUADO':
      return 21 + Math.floor(random() * 9);
    case 'AVANZADO':
      return 14 + Math.floor(random() * 7);
    case 'INTERMEDIO':
      return 6 + Math.floor(random() * 8);
    case 'INICIAL':
      return 1 + Math.floor(random() * 5);
    default:
      return 0;
  }
}

const HISTORICAL_TYPES: ParticipationType[] = [
  'ASISTENTE',
  'ASISTENTE',
  'ASISTENTE',
  'ORGANIZADOR',
  'PONENTE',
  'PANELISTA',
];

function buildHistoricalParticipations(
  events: AcademicEvent[],
  students: Student[],
  takenCodes: Set<string>,
  sequenceStart: number
): Participation[] {
  // Los eventos finalizados, del mas antiguo al mas reciente. Así el historial
  // de cada estudiante queda ordenado sin tener que ordenarlo despues.
  const finished = events
    .filter((event) => event.status === 'Finalizado')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (finished.length === 0) {
    return [];
  }

  const random = createRandom(7_194_031);
  const participations: Participation[] = [];
  let sequence = sequenceStart;

  for (const student of students) {
    // Los 20 primeros estudiantes ya tienen su caso a mano en PARTICIPATION_SEEDS.
    if (student.universityCode.startsWith('22')) {
      continue;
    }

    const target = targetCreditsOf(pickProfile(random), random);
    let accumulated = 0;

    for (const event of finished) {
      if (accumulated >= target) {
        break;
      }

      const seedKey = `${event.id}:${student.universityCode}`;
      let verificationCode = deterministicVerificationCode(seedKey);
      let attempt = 1;
      while (takenCodes.has(verificationCode)) {
        attempt++;
        verificationCode = deterministicVerificationCode(`${seedKey}#${attempt}`);
      }
      takenCodes.add(verificationCode);

      accumulated += event.credits;
      sequence++;

      participations.push({
        id: `par-${String(sequence).padStart(6, '0')}`,
        eventId: event.id,
        studentId: student.id,
        participationType:
          HISTORICAL_TYPES[Math.floor(random() * HISTORICAL_TYPES.length)],
        participationDate: event.startDate,
        credits: event.credits,
        verificationCode,
        legacyCode: null,
        // La nota se registra solo en parte del historial: asi se ejercita el caso
        // "participacion vigente sin nota", que no debe contar como 0.
        grade: random() < 0.7 ? 13 + Math.floor(random() * 7) : null,
        status: 'VALID',
      });
    }
  }

  return participations;
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildMockParticipations(
  events: AcademicEvent[],
  students: Student[]
): Participation[] {
  const studentByCode = new Map(students.map((student) => [student.universityCode, student]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const takenCodes = new Set<string>();

  const seedParticipations = PARTICIPATION_SEEDS.map((seed, index) => {
    const student = studentByCode.get(seed.universityCode);
    const event = eventById.get(seed.eventId);

    if (!student || !event) {
      throw new Error(`Mock de participaciones inconsistente: ${seed.universityCode}/${seed.eventId}`);
    }

    const origin = seed.origin ?? 'DC';

    // El verificationCode es UNIQUE: ante una colision de hash se rehashea con
    // un sufijo determinista en lugar de repetir el codigo.
    const seedKey = `${seed.eventId}:${student.universityCode}`;
    const mintDcCode = (): string => {
      let verificationCode = deterministicVerificationCode(seedKey);
      let attempt = 1;
      while (takenCodes.has(verificationCode)) {
        attempt++;
        verificationCode = deterministicVerificationCode(`${seedKey}#${attempt}`);
      }
      takenCodes.add(verificationCode);
      return verificationCode;
    };

    // Una participacion migrada SIN codigo DC debe seguir el flujo del sistema
    // anterior hasta que se le asigne uno propio.
    const verificationCode = origin === 'LEGACY' ? null : mintDcCode();
    const legacyCode = origin === 'DC' ? null : (seed.legacyCode ?? null);

    return {
      id: `par-${String(index + 1).padStart(4, '0')}`,
      eventId: seed.eventId,
      studentId: student.id,
      participationType: seed.participationType,
      participationDate: event.startDate,
      credits: seed.credits ?? event.credits,
      verificationCode,
      legacyCode,
      grade: seed.grade,
      status: seed.status,
    };
  });

  return [
    ...seedParticipations,
    ...buildHistoricalParticipations(events, students, takenCodes, PARTICIPATION_SEEDS.length),
  ];
}
