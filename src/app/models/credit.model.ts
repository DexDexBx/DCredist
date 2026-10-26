/**
 * CREDITOS DE DCREDITS.
 *
 * REGLA INMUTABLE: los creditos acumulados NUNCA se guardan como un total
 * manual. Siempre se derivan de las participaciones vigentes:
 *
 *   creditos acumulados = SUM(Participation.credits WHERE status = 'VALID')
 *
 * La meta (21 por defecto) NO es un total por estudiante: es el parametro
 * contra el que se mide el avance. Cambiarla recalcula todos los porcentajes.
 */

import { Student, StudentQuery } from './student.model';

/** Meta institucional de creditos para egresar. */
export const DEFAULT_CREDITS_TARGET = 21;

/**
 * Avance hacia la meta, en porcentaje acotado a 100.
 *
 * Un estudiante puede superar la meta: el avance se detiene en 100 y
 * `remainingCredits` llega a 0.
 */
export function creditsProgress(totalCredits: number, target: number = DEFAULT_CREDITS_TARGET): number {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((totalCredits / target) * 1000) / 10);
}

/** Creditos que faltan para alcanzar la meta. Nunca negativo. */
export function remainingCredits(totalCredits: number, target: number = DEFAULT_CREDITS_TARGET): number {
  return roundCredits(Math.max(0, target - totalCredits));
}

/** Evita los errores de coma flotante al sumar creditos (1.5 + 2 + 1 = 4.5). */
export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Situacion del estudiante frente a la meta.
 *
 * Es una pregunta de conteo, no de porcentaje: "cuantos completaron" y "cuantos
 * todavia no empiezan" se responden con numeros enteros sobre el padron.
 */
export type CreditFilter = 'all' | 'COMPLETED' | 'IN_PROGRESS' | 'WITHOUT_CREDITS';

export const CREDIT_FILTER_LABEL: Record<CreditFilter, string> = {
  all: 'Todos',
  COMPLETED: 'Completados',
  IN_PROGRESS: 'En progreso',
  WITHOUT_CREDITS: 'Sin créditos',
};

export type CreditSortKey = 'progress' | 'credits' | 'name';

/**
 * Filtros de la tabla de acreditacion.
 *
 * Los tres campos de padron son los mismos que `StudentQuery`: la tabla de
 * creditos busca en el mismo padron, asi que reutiliza el filtro en vez de
 * duplicarlo.
 */
export interface CreditQuery
  extends Pick<StudentQuery, 'search' | 'professionalSchool' | 'headquarters' | 'page' | 'pageSize'> {
  filter?: CreditFilter;
  sort?: CreditSortKey;
}

/** Fila de la tabla de acreditacion: estudiante + su avance. */
export interface CreditRow {
  student: Student;
  name: string;
  summary: StudentCreditSummary;
}

/**
 * Conteo por situacion de los estudiantes que cumplen los filtros.
 *
 * Son las cifras que consumen las tarjetas superiores: sin ellas, un filtro de
 * "Completados" dejaria los numeros del padron sin relacion con lo que se ve.
 */
export interface CreditCounts {
  all: number;
  completed: number;
  inProgress: number;
  withoutCredits: number;
}

export interface CreditRowsPage {
  items: CreditRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  from: number;
  to: number;
  counts: CreditCounts;
}

/**
 * Porcentaje de un conteo sobre el total, acotado a 100 decimales.
 *
 * Devuelve 0 cuando el total es 0: sin denominador no hay porcentaje que
 * mostrar, y un NaN en una tarjeta se ve como un error.
 */
export function percentage(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 1000) / 10;
}

/** Estudiante con su avance hacia la meta: es lo que muestra la vista de creditos. */
export interface StudentCreditProgress {
  studentId: string;
  /** Suma de Participation.credits de las participaciones VALID. */
  totalCredits: number;
  creditsTarget: number;
  /** Porcentaje 0..100. */
  progress: number;
  remainingCredits: number;
  completed: boolean;
  /** Todas las participaciones registradas, sin importar su estado. */
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  pendingParticipations: number;
  /** Eventos distintos en los que el estudiante tiene participacion vigente. */
  eventsParticipated: number;
  /** Participaciones vigentes sin nota registrada. */
  pendingGrades: number;
}

/**
 * Resumen de creditos de un estudiante.
 *
 * Es la forma "plana" que devuelve la API (`StudentCreditSummaryDto`); la vista
 * de creditos trabaja con `StudentCreditProgress`, que ya trae el avance.
 */
export interface StudentCreditSummary extends StudentCreditProgress {
  /**
   * Participaciones con codigo DC listo para emitir certificado.
   *
   * Como toda participacion registrada trae codigo, esto equivale al total de
   * participaciones: queda como campo explicito para los reportes que lo
   * piden por nombre en lugar de recalcularlo.
   */
  certificateCount: number;
}

/** Avance global hacia la meta, para el dashboard. */
export interface CreditsProgressSummary {
  creditsTarget: number;
  totalCredits: number;
  remainingCredits: number;
  averageProgress: number;
  studentsCompleted: number;
  studentsWithCredits: number;
  totalStudents: number;
}

/**
 * Corte de acreditacion del padron: CONTEO DE ESTUDIANTES, no un porcentaje de
 * carrera.
 *
 * Es la pregunta que hace la institucion: cuantos de sus estudiantes ya cumplieron
 * la meta, cuantos van en camino y cuantos no.
 *
 * El avance porcentual se conserva, pero como dato secundario: el "porcentaje de
 * una carrera" depende de un plan de estudios que DCredits no conoce.
 */
export interface AccreditationSummary extends CreditsProgressSummary {
  /** Estudiantes que ya alcanzaron la meta. */
  studentsCompleted: number;
  /** Estudiantes con creditos pero por debajo de la meta. */
  studentsInProgress: number;
  /** Estudiantes sin ninguna participacion vigente: no tienen nada que promediar. */
  studentsWithoutCredits: number;
  /** Percentage de estudiantes que ya cumplieron la meta (0..100). */
  completionRate: number;
  /** Percentage de estudiantes con al menos un credito (0..100). */
  participationRate: number;
}

export interface SchoolCreditSummary {
  professionalSchool: string;
  students: number;
  activeStudents: number;
  participations: number;
  validParticipations: number;
  totalCredits: number;
}
