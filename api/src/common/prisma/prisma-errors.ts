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
}

/** true si el error es una violacion de unicidad sobre el campo indicado. */
export function isUniqueViolation(error: unknown, target: string): boolean {
  if (!isPrismaLikeError(error) || error.code !== 'P2002') {
    return false;
  }

  const fields = Array.isArray(error.meta?.target)
    ? error.meta?.target.join(',')
    : String(error.meta?.target ?? '');

  return fields.includes(target);
}

/** true si el error es una violacion de foreign key (referencia inexistente). */
export function isForeignKeyViolation(error: unknown): boolean {
  return isPrismaLikeError(error) && error.code === 'P2003';
}

function isPrismaLikeError(error: unknown): error is PrismaLikeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}
