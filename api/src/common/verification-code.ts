import { randomInt } from 'node:crypto';
import type { PrismaService } from './prisma/prisma.service';

/**
 * CODIGO UNICO DE PARTICIPACION (DCredits).
 *
 * Formato: DC-AAAA-XXXXXX   (por ejemplo DC-2026-8F4K2P)
 *
 * Reglas:
 *  - se genera UNA SOLA VEZ, en el servidor, al crear la participacion,
 *  - es unico (constraint UNIQUE en `participations.verificationCode`),
 *  - es estable: consultar la participacion jamas lo regenera,
 *  - es tambien el codigo del certificado: es el dato que se envia para
 *    generarlos. No existe un segundo codigo.
 *
 * Se excluyen I y O para reducir errores de digitacion.
 */
export const VERIFICATION_CODE_PATTERN = /^DC-\d{4}-[A-Z0-9]{6}$/;

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const BODY_LENGTH = 6;
const MAX_ATTEMPTS = 20;

/**
 * Normaliza la entrada a formato canonico.
 *
 * Tolera null/undefined a proposito: esta funcion es la frontera entre el
 * controller y el dominio, y un parametro ausente debe producir un codigo
 * vacio (que despues se reporta como INVALID_FORMAT), no una excepcion 500.
 */
export function normalizeVerificationCode(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

export function isValidVerificationCode(value: string): boolean {
  return VERIFICATION_CODE_PATTERN.test(normalizeVerificationCode(value));
}

function randomBody(): string {
  let body = '';
  for (let i = 0; i < BODY_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return body;
}

/**
 * Genera un codigo que todavia no existe en PostgreSQL.
 *
 * Consulta la tabla antes de devolver, y ademas el servicio de participaciones
 * vuelve a insertar con retry: la constraint UNIQUE es la garantia real, esta
 * consulta solo evita intentos obvios.
 */
export async function generateUniqueVerificationCode(
  prisma: PrismaService,
  year: number = new Date().getFullYear()
): Promise<string> {
  const prefix = `DC-${year}-`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = `${prefix}${randomBody()}`;
    const taken = await prisma.participation.count({
      where: { verificationCode: candidate },
    });

    if (taken === 0) {
      return candidate;
    }
  }

  throw new Error(
    `No se pudo generar un verificationCode libre tras ${MAX_ATTEMPTS} intentos. Revisa la tabla participations.`
  );
}
