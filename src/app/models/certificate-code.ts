/**
 * CODIGOS DE CERTIFICADO EN DCREDITS.
 *
 * DCredits maneja DOS nomenclaturas porque conviven dos sistemas:
 *
 *  - CODIGO DC (nuevo): "DC-AAAA-XXXXXX". Lo genera DCredits, es unico y
 *    estable. Es la nomenclatura que se empieza a emitir desde la puesta en
 *    marcha.
 *
 *  - CODIGO ANTERIOR (historico): el que emitia el sistema previo. Tiene
 *    nomenclatura propia, con letras y caracteres especiales, y no sigue
 *    ningun patron. Se conserva TAL CUAL: nunca se reinterpreta, se "corrige"
 *    ni se convierte al formato nuevo. Un certificado ya impreso debe seguir
 *    siendo localizable con el codigo que el estudiante conoce.
 *
 * Un registro puede tener el codigo DC, el anterior, o ambos (cuando se
 * migra un certificado historico y DCredits le asigna ademas su codigo propio).
 *
 * El origen NO se guarda en un campo mas: se deriva de los propios codigos, de
 * modo que nunca puede quedar desincronizado del dato real.
 */

/** Nomenclaturas que conviven en el dominio. */
export type CertificateCodeOrigin = 'DCREDITS' | 'LEGACY' | 'BOTH' | 'NONE';

export const CERTIFICATE_CODE_ORIGIN_LABEL: Record<CertificateCodeOrigin, string> = {
  DCREDITS: 'Código DC',
  LEGACY: 'Código anterior',
  BOTH: 'Código DC y anterior',
  NONE: 'Sin código',
};

/** Forma minima que necesita leer los codigos de una participacion. */
export interface CertificateCodes {
  verificationCode?: string | null;
  legacyCode?: string | null;
}

/**
 * Normaliza un codigo anterior para guardarlo.
 *
 * Solo recorta y colapsa espacios: conserva mayusculas, guiones, barras,
 * puntos y demas caracteres especiales del sistema previo. Un codigo
 * historico no se "normaliza" porque su forma ES parte del dato.
 */
export function normalizeLegacyCode(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Version comparable de un codigo anterior: sin espacios redundantes y en
 * mayusculas, pero respetando los caracteres especiales.
 */
export function legacyCodeForCompare(value: string | null | undefined): string {
  return (normalizeLegacyCode(value) ?? '').toUpperCase();
}

/**
 * Version tolerante para BUSQUEDAS: se queda solo con letras y digitos.
 *
 * Permite que "ABC 12/34" encuentre a "ABC-1234" sin crear un indice por cada
 * variante posible. No se usa para comparar igualdad, solo para coincidir.
 */
export function compactCode(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Indica si el valor sigue la nomenclatura DC (y por tanto no es un legado). */
export function isDcCertificateCode(value: string | null | undefined): boolean {
  return /^DC-\d{4}-[A-Z0-9]{6}$/.test((value ?? '').trim().toUpperCase());
}

/** De donde viene el codigo que se muestra al usuario. */
export function certificateOrigin(codes: CertificateCodes): CertificateCodeOrigin {
  const hasDc = Boolean((codes.verificationCode ?? '').trim());
  const hasLegacy = Boolean(normalizeLegacyCode(codes.legacyCode));

  if (hasDc && hasLegacy) {
    return 'BOTH';
  }

  if (hasDc) {
    return 'DCREDITS';
  }

  return hasLegacy ? 'LEGACY' : 'NONE';
}

/**
 * Codigo que se muestra y se imprime: el DC si existe, y si no el anterior.
 *
 * Es el criterio para el archivo institucional y para la ficha: el
 * certificado siempre tiene UN codigo visible, sin importar de que sistema
 * venga.
 */
export function primaryCertificateCode(codes: CertificateCodes): string | null {
  const dc = (codes.verificationCode ?? '').trim();
  if (dc) {
    return dc;
  }

  return normalizeLegacyCode(codes.legacyCode);
}

/** Etiqueta corta del origen, util para tooltips y badges. */
export function certificateCodeLabel(codes: CertificateCodes): string {
  return CERTIFICATE_CODE_ORIGIN_LABEL[certificateOrigin(codes)];
}

/** Compara dos codigos de la misma participacion sin depender de los espacios. */
export function sameCertificateCode(
  first: string | null | undefined,
  second: string | null | undefined
): boolean {
  const a = compactCode(first);
  const b = compactCode(second);
  return a.length > 0 && a === b;
}

/**
 * Coincidencia tolerante de un codigo con lo que escribe el usuario.
 * Se usa en busquedas, no para decidir identidad.
 */
export function codeContains(
  code: string | null | undefined,
  needle: string | null | undefined
): boolean {
  const target = compactCode(needle);
  return target.length > 0 && compactCode(code).includes(target);
}

/** Texto listo para una etiqueta de Excel: nunca "undefined". */
export function legacyCodeText(codes: CertificateCodes): string {
  return normalizeLegacyCode(codes.legacyCode) ?? '';
}
