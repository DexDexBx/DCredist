/**
 * CODIGO DE VERIFICACION DE DCREDITS.
 *
 * Formato: DC-AAAA-XXXXXX  (por ejemplo DC-2026-8F4K2P)
 *
 * Es el codigo que emite DCredits: unico, estable y no cambia aunque se anule la
 * participacion. Lo genera DCredits y es el que se envia para generar los
 * certificados.
 *
 * No es el UNICO codigo que puede tener una participacion: convive con el que
 * emitia el sistema anterior (ver `certificate-code.ts`), que se conserva tal
 * cual. Ambos se pueden consultar en la pantalla de verificacion.
 */

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const BODY_LENGTH = 6;
const DEFAULT_YEAR = new Date().getFullYear();

export const VERIFICATION_CODE_PATTERN = /^DC-\d{4}-[A-Z0-9]{6}$/;

export function normalizeVerificationCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidVerificationCode(value: string): boolean {
  return VERIFICATION_CODE_PATTERN.test(normalizeVerificationCode(value));
}

function randomBody(): string {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return body;
}

/**
 * Genera un codigo de verificacion unico dentro del conjunto existente.
 * La exclusion de caracteres ambiguos (I, O) reduce errores de digitacion.
 *
 * Acepta un Set o un array de codigos ya ocupados. Con el historial completo hay
 * mas de un millon de participaciones: reconstruir un Set de un millon de
 * elementos por cada codigo emitido convertia la migracion en un trabajo de
 * minutos, asi que quien ya lo tiene construido puede reutilizarlo.
 *
 * En el backend este codigo debe generarse en el servidor con una
 * constraint UNIQUE en base de datos, nunca en el navegador.
 */
export function generateVerificationCode(
  existingCodes: ReadonlySet<string> | readonly string[] = new Set(),
  year: number = DEFAULT_YEAR
): string {
  const taken =
    existingCodes instanceof Set
      ? existingCodes
      : new Set(Array.from(existingCodes, normalizeVerificationCode));
  const prefix = `DC-${year}-`;

  for (let attempt = 0; attempt < 500; attempt++) {
    const candidate = `${prefix}${randomBody()}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  // Respaldo determinista: no deberia alcanzarse, pero garantiza unicidad.
  let sequence = taken.size + 1;
  let candidate = `${prefix}${sequence.toString(36).toUpperCase().padStart(BODY_LENGTH, '0')}`;
  while (taken.has(candidate)) {
    sequence++;
    candidate = `${prefix}${sequence.toString(36).toUpperCase().padStart(BODY_LENGTH, '0')}`;
  }
  return candidate;
}
