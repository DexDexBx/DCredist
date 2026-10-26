/**
 * Utilidades de generacion de archivos CSV para DCredits.
 *
 * El archivo institucional se genera con separador ";" y BOM UTF-8 porque se
 * abre con Excel en configuracion regional es-ES, donde la coma es separador de
 * decimales.
 */

const CRLF = '\r\n';
const BOM = '\uFEFF';

export function escapeCsvValue(value: string, delimiter: string): string {
  const raw = value ?? '';
  const needsQuotes =
    raw.includes(delimiter) ||
    raw.includes('"') ||
    raw.includes('\n') ||
    raw.includes('\r');

  return needsQuotes ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export function buildCsv(
  rows: string[][],
  delimiter: string,
  withBom = true
): string {
  const body = rows.map((row) => row.map((value) => escapeCsvValue(value, delimiter)).join(delimiter));
  return `${withBom ? BOM : ''}${body.join(CRLF)}${CRLF}`;
}

/**
 * Numero decimal sin ceros sobrantes: 1.5 -> "1.5", 2 -> "2", 17 -> "17".
 * Evita el ruido de coma flotante al sumar creditos.
 */
export function formatDecimal(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Creditos: 1.5 -> "1.5", 2 -> "2" (sin ceros decimales sobrantes). */
export function formatCredits(value: number): string {
  return formatDecimal(value);
}

/**
 * Nota: 16 -> "16", 17.5 -> "17.5". Si la nota no esta registrada se devuelve
 * cadena vacia, NUNCA 0: una participacion sin nota se exporta con celda vacia.
 */
export function formatGrade(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return formatDecimal(value);
}

/** Normaliza un valor opcional a cadena, devolviendo "" cuando no existe. */
export function optionalText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '';
}

/** Nombre de archivo seguro, por ejemplo "DCredits_EVT-2026-002_participantes.csv". */
export function buildFileName(parts: (string | undefined | null)[], extension = 'csv'): string {
  const slug = parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim().replace(/[^A-Za-z0-9._-]+/g, '-'))
    .filter((part) => part.length > 0)
    .join('_');
  return `${slug || 'DCredits'}.${extension}`;
}

export interface CsvDownload {
  fileName: string;
  mimeType: string;
  content: string;
}

/**
 * Separa una linea en celdas respetando las comillas dobles de Excel.
 * Si la linea no trae separador, se devuelve entera como una unica celda.
 */
function splitLine(line: string, delimiter: string): string[] {
  if (!delimiter) {
    return [line.trim()];
  }

  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

/** Tabulador y ";" primero (Excel es-ES); la coma es el respaldo de un CSV en-US. */
function detectDelimiter(line: string): string {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  return '';
}

/**
 * Convierte un bloque de texto pegado o un archivo cargado en filas y columnas.
 * Acepta separador ";", tabulador o coma, igual que Excel segun la configuracion
 * regional. Ignora lineas vacias y una eventual linea de encabezado.
 */
export function parseDelimitedText(
  text: string,
  expectedColumns: number
): string[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => splitLine(line, detectDelimiter(line)))
    .filter((row, index) => {
      if (row.length < expectedColumns) {
        return false;
      }
      // Descarta la linea de encabezado si contiene letras en todas las celdas.
      return index === 0 ? !row.every((cell) => isNaN(Number(cell))) : true;
    });
}

/** Dispara la descarga en el navegador. */
export function downloadCsv(download: CsvDownload): void {
  const blob = new Blob([download.content], { type: download.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = download.fileName;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
