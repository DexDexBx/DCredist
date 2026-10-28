import { Student } from '../../../models';

/**
 * MOCK DATA - PADRÓN MAESTRO DE ESTUDIANTES.
 * Sin datos de prueba. Se cargará desde la API o se creará manualmente.
 */

export const PROFESSIONAL_SCHOOLS = [] as const;
export const HEADQUARTERS = [] as const;

export const DEFAULT_MOCK_STUDENT_COUNT = 0;

/** Tope del parámetro `?padron=`, para no bloquear la pestaña por error. */
const MAX_MOCK_STUDENT_COUNT = 300_000;

/**
 * Volumen pedido por URL: `?padron=`.
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
 * Padrón de desarrollo. Sin datos de prueba.
 */
export function buildMockStudents(total: number = resolveMockStudentCount()): Student[] {
  return [];
}
