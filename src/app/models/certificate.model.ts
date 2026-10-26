/**
 * CERTIFICADO DE CREDITOS ACADEMICOS.
 *
 * Regla de dominio de DCredits V1: un estudiante SOLO puede emitir su certificado
 * cuando acumula al menos 21 creditos vigentes. Por debajo de ese umbral se
 * muestra una constancia de avance (informativa) y NUNCA el certificado.
 *
 * El certificado NO es un PDF ni una firma digital: en V1 es la vista formal con
 * los datos del estudiante, el detalle de participaciones con sus codigos de
 * verificacion y un codigo general de validacion del documento.
 */

import { DEFAULT_CREDITS_TARGET } from './credit.model';
import type { Student } from './student.model';

/** Creditos minimos exigidos para emitir el certificado. */
export const REQUIRED_CREDITS = DEFAULT_CREDITS_TARGET;

/** ¿El estudiante alcanzo los creditos requeridos para su certificado? */
export function meetsCertificateRequirement(
  totalCredits: number,
  required: number = REQUIRED_CREDITS
): boolean {
  return totalCredits >= required;
}

/** Creditos que aun faltan para alcanzar el minimo. Nunca negativo. */
export function missingCreditsForCertificate(
  totalCredits: number,
  required: number = REQUIRED_CREDITS
): number {
  return Math.max(0, required - totalCredits);
}

/**
 * Hash corto y determinista para el codigo de validacion.
 *
 * Determinista a proposito: el mismo estudiante produce siempre el mismo codigo,
 * de modo que dos renders del certificado no muestran codigos distintos.
 */
function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

/**
 * Codigo general de validacion del certificado.
 *
 * Formato: CONST-<codigo universitario>-<hash>. Permite identificar el documento
 * sin depender de los codigos individuales de cada participacion.
 */
export function buildCertificateValidationCode(
  student: Pick<Student, 'id' | 'universityCode'>
): string {
  return `CONST-${student.universityCode}-${shortHash(student.id)}`;
}
