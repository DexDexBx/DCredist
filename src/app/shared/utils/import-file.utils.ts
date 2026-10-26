import { readXlsx } from './xlsx.utils';

/**
 * ARCHIVOS DE LAS IMPORTACIONES MASIVAS.
 *
 * El usuario puede subir la plantilla rellenada en Excel (.xlsx) o el archivo
 * de texto equivalente (.csv / .txt). En ambos casos el archivo se convierte a
 * texto delimitado con tabulador, que es lo que consumen los parsers de las
 * features (parseDelimitedText).
 */

const EXCEL_EXTENSIONS = ['.xlsx', '.xlsm'];

/** Atributo `accept` de los inputs de archivo de importacion. */
export const IMPORT_FILE_ACCEPT = [
  ...EXCEL_EXTENSIONS,
  '.csv',
  '.txt',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
].join(',');

/** Extensiones admitidas, para validar el archivo arrastrado/seleccionado. */
const SUPPORTED_EXTENSIONS = [...EXCEL_EXTENSIONS, '.csv', '.txt'];

export function isImportFileSupported(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return EXCEL_EXTENSIONS.some((extension) => name.endsWith(extension));
}

/**
 * Convierte el archivo cargado en texto delimitado: una fila por linea y las
 * celdas separadas por tabulador (parseDelimitedText prioriza el tabulador).
 * Los saltos de linea dentro de una celda se colapsan para no romper filas.
 */
export async function readImportFileText(file: File): Promise<string> {
  if (isExcelFile(file)) {
    const rows = await readXlsx(file);
    return rows
      .map((row) => row.map((cell) => cell.replace(/[\r\n]+/g, ' ')).join('\t'))
      .join('\n');
  }

  return file.text();
}
