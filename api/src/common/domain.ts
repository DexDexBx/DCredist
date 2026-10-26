/**
 * CONSTANTES DE DOMINIO DE DCREDITS.
 *
 * Viven en el backend porque son reglas del dominio, no de la interfaz: la API
 * valida contra estas listas y el frontend se limita a ofrecerlas como opciones.
 */

/**
 * Categoria academica de un evento. Es el "tipo" que ve la institucion.
 *
 * `Event.eventType` (SINGLE_DAY / MULTI_DAY) es otra cosa: se deriva de las
 * fechas y no se elige a mano.
 */
export const EVENT_CATEGORIES = [
  'Congreso',
  'Seminario',
  'Taller',
  'Curso',
  'Foro',
  'Conferencia',
  'Webinar',
  'Muestra',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export function isEventCategory(value: string): value is EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(value);
}

/** La nota maxima institucional. Evita 0 como "sin nota". */
export const MAX_GRADE = 20;

/**
 * Meta de creditos para egresar: 21 por defecto.
 *
 * Es un dato del dominio, no un total manual por estudiante. El avance de cada
 * estudiante se calcula contra esta meta y se ajusta en un solo lugar, con la
 * variable de entorno `DCREDITS_CREDITS_TARGET`, sin tocar PostgreSQL ni el
 * codigo. Los creditos acumulados SIEMPRE se derivan de las participaciones
 * VALID: la meta solo sirve para medir el avance.
 */
export const DEFAULT_CREDITS_TARGET = 21;

/** Meta vigente, con 21 como valor por defecto. Siempre > 0. */
export function creditsTarget(): number {
  const configured = Number(process.env['DCREDITS_CREDITS_TARGET']);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CREDITS_TARGET;
}

/**
 * Avance hacia la meta, en porcentaje acotado a 100.
 * Un estudiante puede superar la meta: el avance se detiene en 100.
 */
export function creditsProgress(totalCredits: number, target = creditsTarget()): number {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((totalCredits / target) * 1000) / 10);
}