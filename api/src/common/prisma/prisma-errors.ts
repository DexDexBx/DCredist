/**
 * ERRORES DE POSTGRESQL RELEVANTES PARA DCREDITS.
 *
 * El codigo P2002 de Prisma corresponde al SQLSTATE 23505 (unique_violation).
 * Las constraints UNIQUE de la base de datos son la garantia real de unicidad;
 * estas funciones solo permiten traducirlas a un 409 legible.
 */

interface PrismaLikeError {
  code?: unknown;
  meta?: { target?: unknown };
  message?: unknown;
}

/**
 * true si el error es una violacion de unicidad sobre el campo indicado.
 *
 * Ademas de `meta.target`, se revisa el mensaje: en indices creados por SQL
 * (por ejemplo, el compuesto de codigos historicos o el parcial de codigos
 * actuales) Prisma puede no conocer los campos y dejar `target` vacio.
 */
export function isUniqueViolation(error: unknown, target: string): boolean {
  if (!isPrismaLikeError(error)) {
    return false;
  }

  // P2002 es el codigo de Prisma; 23505 es el SQLSTATE de PostgreSQL si el
  // error llega sin envolver.
  if (error.code !== 'P2002' && error.code !== '23505') {
    return false;
  }

  const fields = Array.isArray(error.meta?.target)
    ? error.meta?.target.join(',')
    : String(error.meta?.target ?? '');

  if (fields.includes(target)) {
    return true;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  return message.toLowerCase().includes(target.toLowerCase());
}

/** true si el error es una violacion de foreign key (referencia inexistente). */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPrismaLikeError(error) && error.code === 'P2003';
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}
