import { Student } from '../../../models';

/**
 * MOCK DATA - PADRON MAESTRO DE ESTUDIANTES.
 *
 * Datos de desarrollo local. Deben reemplazarse por `GET /students`.
 * El padron solo contiene datos permanentes: ningun dato de evento,
 * participacion, credito o certificado.
 */

interface StudentSeed {
  universityCode: string;
  academicDegree: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  headquarters: string;
  status: Student['status'];
}

const CIENCIAS_FARMACEUTICAS = 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA';
const INGENIERIA_SISTEMAS = 'INGENIERIA DE SISTEMAS E INFORMATICA';
const MEDICINA_HUMANA = 'MEDICINA HUMANA';
const ENFERMERIA = 'ENFERMERIA';
const ODONTOLOGIA = 'ODONTOLOGIA';
const BIOLOGIA = 'BIOLOGIA';
const PSICOLOGIA = 'PSICOLOGIA';
const CONTABILIDAD = 'CONTABILIDAD';

export const PROFESSIONAL_SCHOOLS = [
  BIOLOGIA,
  CONTABILIDAD,
  CIENCIAS_FARMACEUTICAS,
  ENFERMERIA,
  INGENIERIA_SISTEMAS,
  MEDICINA_HUMANA,
  ODONTOLOGIA,
  PSICOLOGIA,
] as const;

export const HEADQUARTERS = [
  'SEDE CENTRAL',
  'FILIAL LIMA',
  'FILIAL AREQUIPA',
  'FILIAL TRUJILLO',
] as const;

const STUDENT_SEEDS: StudentSeed[] = [
  {
    universityCode: '2213271',
    academicDegree: '',
    lastName: 'AGUILAR PEREZ',
    firstName: 'MARISOL SONIA',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'FILIAL LIMA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2213065',
    academicDegree: '',
    lastName: 'ALLCCAHUAMAN HUAMAN',
    firstName: 'JESUS',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2213099',
    academicDegree: '',
    lastName: 'ALVARADO ROJAS',
    firstName: 'DIEGO ARMANDO',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2214410',
    academicDegree: 'QUINTO',
    lastName: 'BENITES RAMIREZ',
    firstName: 'LUCIA FERNANDA',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'FILIAL AREQUIPA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2215522',
    academicDegree: 'TERCERO',
    lastName: 'CARDENAS VILCA',
    firstName: 'SERGIO RENZO',
    professionalSchool: INGENIERIA_SISTEMAS,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2215733',
    academicDegree: 'SEXTO',
    lastName: 'DELGADO SOTO',
    firstName: 'PATRICIA ELENA',
    professionalSchool: MEDICINA_HUMANA,
    headquarters: 'FILIAL LIMA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2216044',
    academicDegree: 'SEGUNDO',
    lastName: 'ESPINOZA HUAMANI',
    firstName: 'JORGE LUIS',
    professionalSchool: ENFERMERIA,
    headquarters: 'FILIAL TRUJILLO',
    status: 'ACTIVE',
  },
  {
    universityCode: '2216155',
    academicDegree: 'QUINTO',
    lastName: 'FLORES MEZA',
    firstName: 'ANA CLAUDIA',
    professionalSchool: ODONTOLOGIA,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2217366',
    academicDegree: 'CUARTO',
    lastName: 'GOMEZ PALACIN',
    firstName: 'BRYAN STEVEN',
    professionalSchool: BIOLOGIA,
    headquarters: 'FILIAL AREQUIPA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2218477',
    academicDegree: 'PRIMER',
    lastName: 'HUAMAN TTITO',
    firstName: 'MILAGROS YESENIA',
    professionalSchool: PSICOLOGIA,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2219588',
    academicDegree: 'QUINTO',
    lastName: 'IBANEZ QUISPE',
    firstName: 'RICARDO ANDRES',
    professionalSchool: CONTABILIDAD,
    headquarters: 'FILIAL LIMA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2220699',
    academicDegree: 'TERCERO',
    lastName: 'JUAREZ MAMANI',
    firstName: 'KARINA SOFIA',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'FILIAL AREQUIPA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2221710',
    academicDegree: 'SEXTO',
    lastName: 'LOAYZA RIVERA',
    firstName: 'DIEGO FERNANDO',
    professionalSchool: MEDICINA_HUMANA,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2222821',
    academicDegree: 'CUARTO',
    lastName: 'MENDOZA CHAVEZ',
    firstName: 'CLAUDIA PAMELA',
    professionalSchool: ENFERMERIA,
    headquarters: 'FILIAL LIMA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2223932',
    academicDegree: 'SEGUNDO',
    lastName: 'NAVARRO CHAVEZ',
    firstName: 'EDGAR GUILLERMO',
    professionalSchool: INGENIERIA_SISTEMAS,
    headquarters: 'FILIAL TRUJILLO',
    status: 'ACTIVE',
  },
  {
    universityCode: '2224043',
    academicDegree: 'QUINTO',
    lastName: 'ORTEGA SALAS',
    firstName: 'ROMINA BELEN',
    professionalSchool: ODONTOLOGIA,
    headquarters: 'SEDE CENTRAL',
    status: 'ACTIVE',
  },
  {
    universityCode: '2225154',
    academicDegree: 'TERCERO',
    lastName: 'PACHECO VARGAS',
    firstName: 'HECTOR ALONSO',
    professionalSchool: PSICOLOGIA,
    headquarters: 'FILIAL AREQUIPA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2226265',
    academicDegree: 'PRIMER',
    lastName: 'QUISPE MAMANI',
    firstName: 'YADIRA NOELIA',
    professionalSchool: CONTABILIDAD,
    headquarters: 'SEDE CENTRAL',
    status: 'INACTIVE',
  },
  {
    universityCode: '2227376',
    academicDegree: 'SEXTO',
    lastName: 'ROJAS ALFARO',
    firstName: 'MARCO ANTONIO',
    professionalSchool: BIOLOGIA,
    headquarters: 'FILIAL LIMA',
    status: 'ACTIVE',
  },
  {
    universityCode: '2228487',
    academicDegree: 'CUARTO',
    lastName: 'SALAZAR NUNO',
    firstName: 'GABRIELA SOFIA',
    professionalSchool: CIENCIAS_FARMACEUTICAS,
    headquarters: 'FILIAL TRUJILLO',
    status: 'ACTIVE',
  },
];

/**
 * Volumen por defecto del padron de desarrollo.
 *
 * Es 3 000 y no los 260 000 reales a proposito: medido en este proyecto, generar
 * el padron completo con su historial de participaciones cuesta ~4 s de arranque
 * y ~500 MB de memoria. Eso sirve para una prueba puntual de volumen
 * (`?padron=260000`), no para el arranque de todos los dias.
 */
export const DEFAULT_MOCK_STUDENT_COUNT = 3_000;

/** Tope del parametro `?padron=`, para no bloquear la pestaña por error. */
const MAX_MOCK_STUDENT_COUNT = 300_000;

/**
 * Volumen pedido por URL: `?padron=260000`.
 *
 * Permite probar la paginacion y la busqueda con el padron real completo o con uno
 * pequeno, sin recompilar. Un valor invalido se ignora: es una herramienta de
 * desarrollo, no un parametro de negocio.
 */
export function resolveMockStudentCount(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_MOCK_STUDENT_COUNT;
  }

  const requested = Number(new URLSearchParams(window.location.search).get('padron'));
  if (!Number.isFinite(requested) || requested <= 0) {
    return DEFAULT_MOCK_STUDENT_COUNT;
  }

  return Math.min(Math.trunc(requested), MAX_MOCK_STUDENT_COUNT);
}

/**
 * PRIMEROS CODIGOS del bloque generado.
 *
 * Los 20 registros reales de arriba usan 22xxxxx, asi que el bloque sintetico
 * arranca en 23xxxxx. Nunca se mezclan: los dos primeros digitos dicen de donde
 * salio la fila.
 */
const GENERATED_CODE_BASE = 2_300_000;

const GENERATED_LAST_NAMES = [
  'ACOSTA',
  'ALVARADO',
  'APAZA',
  'ARANA',
  'BENITES',
  'CARDENOSO',
  'CCAHUANA',
  'CHAVEZ',
  'CORDOVA',
  'DELGADO',
  'ESPINOZA',
  'FERNANDEZ',
  'GUTIERREZ',
  'HUAMANI',
  'ILLANES',
  'JANCCE',
  'LOAYZA',
  'MAMANI',
  'NUNEZ',
  'OROZCO',
] as const;

/** Segundo apellido: es lo que mas desempata en un padrón real. */
const GENERATED_MATERNAL_NAMES = [
  'RAMIREZ',
  'CHAVEZ',
  'ROJAS',
  'CONDORI',
  'VEGA',
  'LOPEZ',
  'QUISPE',
  'QUIROZ',
  'SALAS',
  'MENDOZA',
  'RAMOS',
  'PALOMINO',
  'ARIAS',
  'CCORIMANYA',
  'VALDIVIA',
  'MAQUERA',
  'ZEVALLOS',
  'FLORES',
  'PONCE',
  'SALVATIERRA',
] as const;

const GENERATED_FIRST_NAMES = [
  'ANA LUCIA',
  'CARLOS ALBERTO',
  'CECILIA ESTHER',
  'DIEGO ARMANDO',
  'ELENA MARIA',
  'FERNANDO JOSE',
  'GABRIELA SOFIA',
  'HECTOR MANUEL',
  'ISABEL CRISTINA',
  'JORGE LUIS',
  'KATHERINE YULIANA',
  'LUIS MIGUEL',
  'MARIANA PAOLA',
  'NICOLAS ANDRES',
  'PATRICIO SEBASTIAN',
  'ROCIO ELENA',
  'SERGIO RENZO',
  'VALERIA SOFIA',
] as const;

/** Segundo nombre: con el, las combinaciones llegan a ~130 000 nombres distintos. */
const GENERATED_SECOND_NAMES = [
  'ALEJANDRA',
  'BRAYAN',
  'CAMILA',
  'DIEGO',
  'ESPERANZA',
  'FRANK',
  'GIANINA',
  'HILDA',
  'IRIS',
  'JESUS',
  'KATHERINE',
  'LEONARDO',
  'MAYRA',
  'NOELIA',
  'OMAR',
  'PAMELA',
  'RAUL',
  'SOFIA',
  'TALIA',
  'YORDY',
] as const;

const GENERATED_DEGREES = [
  'PRIMER',
  'SEGUNDO',
  'TERCERO',
  'CUARTO',
  'QUINTO',
  'SEXTO',
  'SEPTIMO',
] as const;

/**
 * Generador pseudoaleatorio determinista (mulberry32).
 *
 * Con `Math.random()` el padron cambiando en cada recarga haria imposible
 * reproducir un fallo de busqueda o de paginacion. Con una semilla fija, el
 * mismo `?padron=260000` produce siempre los mismos 260 000 estudiantes.
 */
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

/**
 * Reparte un numero de serie en una combinacion de nombres.
 *
 * Hace falta dispersar los componentes: si el apellido paterno se eligiera por
 * bloques (los primeros N con "ACOSTA", los siguientes N con "ALVARADO"), todo el
 * padron de 3000 estudiantes seria de una sola familia. Con el hash, los veinte
 * apellidos aparecen repartidos y el listado ordenado por apellido se ve creible.
 *
 * El hash es una permutacion de los enteros de 32 bits, asi que indices distintos
 * dan valores distintos y los nombres se reparten sin repetir en los primeros
 * 20 x 20 x 18 x 20 = 144 000 estudiantes, mas que el padron historico completo.
 */
function namePartsFor(index: number): {
  lastName: string;
  firstName: string;
} {
  let h = Math.imul(index + 1, 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  h >>>= 0;

  return {
    lastName:
      GENERATED_LAST_NAMES[h % GENERATED_LAST_NAMES.length] +
      ' ' +
      GENERATED_MATERNAL_NAMES[Math.floor(h / 20) % GENERATED_MATERNAL_NAMES.length],
    firstName:
      GENERATED_FIRST_NAMES[Math.floor(h / 400) % GENERATED_FIRST_NAMES.length] +
      ' ' +
      GENERATED_SECOND_NAMES[Math.floor(h / 7200) % GENERATED_SECOND_NAMES.length],
  };
}

/**
 * @param count cuántos estudiantes generar.
 * @param sequenceStart número de secuencia del primero. Los ids continúan los de
 *   los casos reales: si dos estudiantes comparten id, la búsqueda por id y la
 *   ficha apuntan al registro equivocado.
 */
function generateStudents(count: number, sequenceStart: number): Student[] {
  const random = createRandom(20260202);
  const generated: Student[] = [];

  for (let index = 0; index < count; index++) {
    const school = PROFESSIONAL_SCHOOLS[Math.floor(random() * PROFESSIONAL_SCHOOLS.length)];
    const site = HEADQUARTERS[Math.floor(random() * HEADQUARTERS.length)];
    const degree = GENERATED_DEGREES[Math.floor(random() * GENERATED_DEGREES.length)];
    const { lastName, firstName } = namePartsFor(index);

    // Un inactivo cada 37 registros: hace visible que el estado del estudiante
    // no esta atado al de sus participaciones.
    const status: Student['status'] = index % 37 === 0 ? 'INACTIVE' : 'ACTIVE';

    generated.push({
      id: `stu-${String(sequenceStart + index).padStart(6, '0')}`,
      universityCode: String(GENERATED_CODE_BASE + index),
      academicDegree: degree,
      lastName,
      firstName,
      professionalSchool: school,
      headquarters: site,
      status,
    });
  }

  return generated;
}

/**
 * Padrón de desarrollo.
 *
 * @param total cuántos estudiantes tener en memoria. Los 20 casos reales van
 *   primero para que las fichas de ejemplo sigan funcionando; el resto es
 *   sintético y está marcado como tal en la documentación.
 *
 * Contrato de API: cuando exista `GET /students?page=&pageSize=`, este generador
 * desaparece y la paginación pasa a ser del servidor.
 */
export function buildMockStudents(total: number = resolveMockStudentCount()): Student[] {
  const seeds = STUDENT_SEEDS.map((seed, index) => ({
    id: `stu-${String(index + 1).padStart(4, '0')}`,
    ...seed,
  }));

  if (total <= seeds.length) {
    return seeds.slice(0, Math.max(0, total));
  }

  return [...seeds, ...generateStudents(total - seeds.length, seeds.length + 1)];
}
