/**
 * CODIGO DE CONSTANCIA DE CREDITOS.
 *
 * Formato: CONST-<codigo universitario>-<hash>
 *
 * El hash es determinista a partir del id del estudiante, igual que en el
 * frontend historico. Una vez persistido en `constancies.code` ya no se vuelve
 * a calcular: ese valor es el codigo oficial y no cambia aunque el estudiante
 * modifique sus creditos.
 */

export function buildConstancyCode(student: {
  id: number;
  universityCode: string;
}): string {
  return `CONST-${student.universityCode}-${shortHash(student.id)}`;
}

function shortHash(value: string | number): string {
  const text = String(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}
