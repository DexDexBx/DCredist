import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * CONTRASEÑAS DE DCREDITS.
 *
 * La contraseña nunca se guarda en claro: `passwordHash` es un hash scrypt con
 * sal por usuario en formato `scrypt$<salHex>$<hashHex>`. Estas dos funciones
 * son la unica implementacion del algoritmo; las usan el login, el alta de
 * usuarios y el seed, de modo que un cambio de parametros se hace en un solo
 * lugar.
 */

/** Longitud del hash derivado, en bytes. */
const KEY_LENGTH = 64;

/** Longitud de la sal, en bytes. */
const SALT_LENGTH = 16;

/** Genera el hash scrypt de una contraseña en claro. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Compara una contraseña con el hash almacenado.
 *
 * Devuelve false ante un formato desconocido o incompleto en lugar de lanzar:
 * una fila corrupta no debe romper el login.
 */
export function verifyPassword(password: string, passwordHash: string): boolean {
  const [algorithm, saltHex, derivedHex] = passwordHash.split('$');

  if (algorithm !== 'scrypt' || !saltHex || !derivedHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(derivedHex, 'hex');

  if (salt.length === 0 || expected.length === 0) {
    return false;
  }

  const derived = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, derived);
}
