const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Collator para nombres en espanol.
 *
 * `String.localeCompare(a, b, 'es')` construye un `Intl.Collator` nuevo en cada
 * llamada. Ordenar 260 000 filas asi cuesta cientos de milisegundos solo en
 * crear los comparadores, asi que se crea una vez y se reutiliza.
 */
export const NAME_COLLATOR = new Intl.Collator('es');

/**
 * Collator para codigos: `numeric` hace que "EST-2" vaya antes que "EST-10".
 *
 * Un padron ordenado como texto pone a "202410" antes que "20242", que es
 * justo el orden en el que nadie lee un codigo.
 */
export const CODE_COLLATOR = new Intl.Collator('es', { numeric: true });

/** Compara dos codigos de estudiante con el collator numerico. */
export function collateCodes(a: string | undefined | null, b: string | undefined | null): number {
  return CODE_COLLATOR.compare(a ?? '', b ?? '');
}

/**
 * Busca un texto ignorando mayusculas, tildes y Ñ.
 *
 * El padron guarda "PEREZ AGUILAR MARISOL" y la persona escribe "aguilar
 * marisol": con un `includes` normal no lo encuentra. Todos los tokens escritos
 * deben aparecer.
 */
export function matchesTokens(haystack: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) {
    return true;
  }
  for (const token of tokens) {
    if (!haystack.includes(token)) {
      return false;
    }
  }
  return true;
}

/** Texto normalizado para busqueda: sin mayusculas, tildes ni Ñ. */
export function normalizeForSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** `true` si el texto buscado aparece dentro del texto, ignorando tildes y Ñ. */
export function matchesText(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) {
    return false;
  }
  const target = normalizeForSearch(needle);
  return target.length > 0 && normalizeForSearch(haystack).includes(target);
}

/** Divide lo escrito en palabras comparables, sin tildes ni mayusculas. */
export function searchTokens(value: string): string[] {
  return normalizeForSearch(value).split(/\s+/).filter((token) => token.length > 0);
}

/** Caracteres conservados por la forma compacta de un codigo: [A-Z0-9]. */
function compactCharCode(code: number): number {
  let upper = code;
  if (upper >= 97 && upper <= 122) {
    upper -= 32;
  }
  return (upper >= 48 && upper <= 57) || (upper >= 65 && upper <= 90) ? upper : -1;
}

/**
 * Version SIN ASIGNACIONES de "el codigo contiene el fragmento".
 *
 * Buscar un fragmento sobre 1 200 000 participaciones llega a revisar 2 400 000
 * codigos. La version con `compactCode()` crea dos cadenas por comparacion, y eso
 * son casi cinco millones de cadenas por pulsacion: el buscador se trababa varios
 * segundos. Aqui se comparan los codigos caracter a caracter y no se construye
 * nada, porque los codigos son cortos (unos 13 caracteres).
 */
export function codeContainsCompact(
  code: string | null | undefined,
  compactNeedle: string
): boolean {
  if (!code || compactNeedle.length === 0) {
    return false;
  }

  const length = code.length;

  for (let start = 0; start < length; start++) {
    let matched = 0;

    while (start + matched < length && matched < compactNeedle.length) {
      const char = compactCharCode(code.charCodeAt(start + matched));
      if (char < 0 || char !== compactNeedle.charCodeAt(matched)) {
        break;
      }
      matched++;
    }

    if (matched === compactNeedle.length) {
      return true;
    }
  }

  return false;
}

/** Iniciales de un nombre completo: primera letra de las dos primeras palabras. */
export function initialsOf(fullName: string): string {
  const parts = fullName.split(' ').filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** Escapa texto antes de inyectarlo en plantillas de FullCalendar. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Lee un valor desconocido de extendedProps de FullCalendar como texto. */
export function readExtendedText(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}

/** Lee un valor desconocido de extendedProps de FullCalendar como numero. */
export function readExtendedNumber(props: Record<string, unknown>, key: string): number | null {
  const value = props[key];
  return typeof value === 'number' ? value : null;
}
