/**
 * Utilidades para escrituras masivas.
 *
 * PostgreSQL no admite un numero ilimitado de parametros por sentencia
 * (limite ~65535). Un `createMany` con decenas de miles de filas puede superar
 * ese limite y fallar entero. Por eso las cargas masivas se parten en tandas
 * del tamano seguro que indique cada modulo.
 */

/** Parte una lista en tandas del tamano indicado. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length <= size) {
    return items.length > 0 ? [items] : [];
  }

  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * Filas por sentencia `createMany`.
 *
 * 2000 filas x 8 columnas = 16000 parametros, holgadamente por debajo del
 * limite de PostgreSQL y sin picos de memoria.
 */
export const BULK_INSERT_BATCH_SIZE = 2000;
