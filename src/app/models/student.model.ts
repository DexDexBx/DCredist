/**
 * PADRON MAESTRO DE ESTUDIANTES.
 *
 * Solo contiene datos permanentes del estudiante. Ningun dato de evento,
 * participacion, credito o certificado debe almacenarse en este modelo.
 */
export type StudentStatus = 'ACTIVE' | 'INACTIVE';

export interface Student {
  id: string;
  /** Codigo universitario. Identificador funcional y unico. */
  universityCode: string;
  /** Grado academico. Puede estar vacio si la institucion no lo reporta. */
  academicDegree: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  headquarters: string;
  status: StudentStatus;
}

/** Datos-ingreso del padrón, sin identificador interno (lo asigna el repositorio). */
export type StudentDraft = Omit<Student, 'id'>;

/**
 * Filtros soportados por StudentService.getStudents() y getStudentsPage().
 * Mapean 1:1 con los query params de GET /students.
 */
export interface StudentQuery {
  /** Codigo universitario, apellidos o nombres. */
  search?: string;
  professionalSchool?: string;
  headquarters?: string;
  status?: StudentStatus;
  /** 1-based. Sin valor, el servicio devuelve el listado completo. */
  page?: number;
  pageSize?: number;
  sort?: StudentSortKey;
}

export type StudentSortKey = 'name' | 'code' | 'recent';

/** Tamaños de página ofrecidos en la interfaz. El backend define el máximo. */
export const STUDENT_PAGE_SIZES = [25, 50, 100, 200] as const;

export const DEFAULT_STUDENT_PAGE_SIZE = 25;

/**
 * Resultado paginado del padrón.
 *
 * El padrón real tiene cientos de miles de estudiantes: la vista NUNCA recibe la
 * lista completa, solo la página que muestra y el total real para los números.
 */
export interface StudentPage {
  items: Student[];
  /** Total de estudiantes que cumplen los filtros, no los de la página. */
  total: number;
  /** 1-based. Siempre >= 1, incluso sin resultados. */
  page: number;
  pageSize: number;
  pageCount: number;
  /** Primer y ultimo indice (1-based) mostrado; 0 si la pagina esta vacia. */
  from: number;
  to: number;
}

/**
 * Texto que se busca en el padron, ya normalizado.
 *
 * Se separa del estudiante para poder reutilizar la misma comparacion en el
 * indice de busqueda y evitar recomponer el texto en cada pulsacion.
 */
export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Un solo termino con espacios (incluidos multiples) y sin acentos sueltos.
 *
 * "jose maria" y "josé maría" deben encontrar a la misma persona, porque el
 * usuario escribe como le sale y no como esta cargado en el padron.
 */
export function studentSearchHaystack(student: Student): string {
  return `${student.universityCode} ${student.lastName} ${student.firstName} ${student.professionalSchool} ${student.headquarters} ${student.academicDegree}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Coincidencia por tokens: TODAS las palabras tecleadas deben aparecer.
 *
 * Con un unico `includes` sobre el texto completo, "aguilar marisol" fallaba
 * porque el padron guarda "PEREZ AGUILAR MARISOL". Los tokens lo resuelven sin
 * inventar un indice por cada combinacion posible.
 *
 * Pensado para una sola busqueda: si hay que recorrer el padron, usar
 * `searchTokens()` + `matchesStudentTokens()`, que normalizan y separan una vez
 * en vez de en cada estudiante.
 */
export function matchesStudentHaystack(haystack: string, needle: string): boolean {
  if (!needle) {
    return true;
  }

  const target = normalizeSearchText(needle)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return target.split(/\s+/).every((token) => haystack.includes(token));
}

/**
 * Texto de busqueda partido en tokens ya normalizados y sin tildes.
 *
 * Normalizar y separar son operaciones caras si se repiten 260 000 veces por
 * pulsacion: se hacen una sola vez y despues solo quedan comparaciones de texto.
 */
export function searchTokens(search: string): string[] {
  const needle = normalizeSearchText(search)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return needle.length === 0 ? [] : needle.split(/\s+/);
}

/** ¿El texto del padron contiene TODOS los tokens buscados? */
export function matchesStudentTokens(haystack: string, tokens: readonly string[]): boolean {
  for (const token of tokens) {
    if (!haystack.includes(token)) {
      return false;
    }
  }

  return true;
}

export interface StudentValidation {
  valid: boolean;
  errors: Partial<Record<keyof StudentDraft, string>>;
}

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

/** "AGUILAR PEREZ, MARISOL SONIA" */
export function studentFullName(student: Student): string {
  return `${student.lastName}, ${student.firstName}`.trim();
}

/** "MARISOL SONIA AGUILAR PEREZ" */
export function studentDisplayName(student: Student): string {
  return `${student.firstName} ${student.lastName}`.trim();
}
