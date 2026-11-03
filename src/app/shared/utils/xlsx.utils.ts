import type * as ExcelJS from 'exceljs';

/**
 * exceljs pesa ~1 MB: se carga bajo demanda para no engordar el bundle inicial.
 * El import del tipo es solo tipado y desaparece en el bundle.
 */
async function loadExcelJs(): Promise<typeof import('exceljs')> {
  const module = await import('exceljs');
  return module.default ?? module;
}

/** Logo de DCredits en base64 (PNG 240x75), servido desde /public. */
const LOGO_FILE = 'images/dcredits-logo.base64.txt';
const LOGO_WIDTH = 140;
const LOGO_HEIGHT = 44;

const BRAND = 'FFA30D5A';
const TEXT = 'FF101828';
const BORDER = 'FFE4E7EB';
const FONT = 'Calibri';

/**
 * Encabezados que se escriben como numero en Excel para que se puedan
 * ordenar y sumar. Todo lo demas se conserva como texto: los codigos
 * universitarios y los codigos de certificado NUNCA son numeros.
 */
const NUMERIC_HEADERS = new Set([
  'N°',
  'NÚMERO DE CRÉDITOS',
  'CRÉDITOS',
  'NOTA',
  'CUPO',
  'PARTICIPANTES',
]);

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

/** Filas reservadas arriba: logo (2) + separacion (1). */
const HEADER_OFFSET = 3;

export interface XlsxCatalogSheet {
  /** Nombre de la hoja que Excel mostrara en la lista desplegable. */
  name: string;
  /** Encabezado de la columna A de esa hoja. */
  header: string;
  /** Valores validos del catalogo. */
  values: string[];
}

export interface XlsxListValidation {
  /** Columna de la hoja principal (1 = A) que tendra la lista. */
  column: number;
  /** Hoja de catalogo que alimenta la lista. */
  catalog: string;
  /** Mensaje que Excel muestra si se escribe un valor que no esta en la lista. */
  error: string;
}

export interface XlsxExportInput {
  fileName: string;
  rows: string[][];
  sheetName?: string;
  /** Hojas auxiliares con los valores validos (por ejemplo escuelas y sedes). */
  catalogSheets?: XlsxCatalogSheet[];
  /** Listas desplegables de la hoja principal alimentadas por `catalogSheets`. */
  listValidations?: XlsxListValidation[];
  /** Cantidad de filas hacia abajo donde se aplican las listas (por defecto 1000). */
  validationRows?: number;
}

/** Texto de una celda, cualquiera que sea su tipo interno de ExcelJS. */
function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    const candidate = value as { text?: unknown; richText?: { text?: string }[]; result?: unknown };
    if (Array.isArray(candidate.richText)) {
      return candidate.richText.map((part) => part.text ?? '').join('');
    }
    if (candidate.text !== undefined) {
      return String(candidate.text);
    }
    if (candidate.result !== undefined) {
      return String(candidate.result ?? '');
    }
    return '';
  }
  return String(value);
}

/**
 * Lee la primera hoja de un .xlsx y devuelve sus filas como texto.
 * Se usa en las importaciones masivas: el usuario puede rellenar la plantilla
 * en Excel y subirla tal cual, sin convertirla a CSV.
 */
export async function readXlsx(file: File): Promise<string[][]> {
  const ExcelJS = await loadExcelJs();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cells[columnNumber - 1] = cellText(cell).trim();
    });
    rows.push(cells);
  });
  return rows;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    // Resuelto contra <base href>: funciona aunque la ruta sea profunda.
    const url = new URL(LOGO_FILE, document.baseURI).toString();
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      return null;
    }
    const text = (await response.text()).trim().replace(/\s+/g, '');
    return /^[A-Za-z0-9+/=]+$/.test(text) && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => !String(cell ?? '').trim());
}

/** Localiza la fila de encabezado: la primera con varias celdas tras el separador. */
function detectHeaderIndex(rows: string[][]): number {
  const blankIndex = rows.findIndex(isEmptyRow);
  const start = blankIndex >= 0 ? blankIndex + 1 : 0;
  for (let index = start; index < rows.length; index += 1) {
    if (rows[index].length > 1 && !isEmptyRow(rows[index])) {
      return index;
    }
  }
  return -1;
}

function applyBorders(cell: ExcelJS.Cell): void {
  const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BORDER } };
  cell.border = { top: thin, left: thin, bottom: thin, right: thin };
}

function columnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function applyColumnWidths(sheet: ExcelJS.Worksheet, rows: string[][]): void {
  const count = columnCount(rows);
  const widths: number[] = [];
  for (let column = 1; column <= count; column += 1) {
    let width = 9;
    for (const row of rows) {
      const value = row[column - 1];
      if (value) {
        width = Math.max(width, Math.min(String(value).length + 3, 42));
      }
    }
    widths.push(width);
    sheet.getColumn(column).width = width;
  }
}

/** Hoja auxiliar que alimenta una lista desplegable. */
function addCatalogSheet(
  workbook: ExcelJS.Workbook,
  catalog: XlsxCatalogSheet,
): void {
  const sheet = workbook.addWorksheet(catalog.name);
  const header = sheet.getRow(1);
  header.getCell(1).value = catalog.header;
  header.getCell(1).font = {
    name: FONT,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  header.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: BRAND },
  };
  header.getCell(1).border = {
    top: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    bottom: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } },
  };

  catalog.values.forEach((value, index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = value;
    row.getCell(1).font = { name: FONT, size: 10, color: { argb: TEXT } };
    row.getCell(1).border = {
      top: { style: 'thin', color: { argb: BORDER } },
      left: { style: 'thin', color: { argb: BORDER } },
      bottom: { style: 'thin', color: { argb: BORDER } },
      right: { style: 'thin', color: { argb: BORDER } },
    };
  });

  sheet.getColumn(1).width = Math.max(
    18,
    Math.min(
      60,
      catalog.values.reduce((max, value) => Math.max(max, value.length + 3), 18),
    ),
  );
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/** Aplica listas desplegables a las columnas indicadas de la hoja principal. */
function applyListValidations(
  sheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  validations: XlsxListValidation[],
  catalogs: XlsxCatalogSheet[],
  rows: number,
): void {
  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = firstDataRow + Math.max(1, rows) - 1;

  for (const validation of validations) {
    const catalog = catalogs.find((item) => item.name === validation.catalog);
    if (!catalog || catalog.values.length === 0) {
      continue;
    }

    const source = `'${catalog.name}'!$A$2:$A$${catalog.values.length + 1}`;
    const rule: ExcelJS.DataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [source],
      showErrorMessage: true,
      errorTitle: 'Valor no válido',
      error: validation.error,
      showInputMessage: true,
      promptTitle: 'Catálogo',
      prompt: 'Selecciona un valor de la lista para evitar errores de importación.',
    };

    // ExcelJS solo expone la validacion por celda; al escribir el libro agrupa
    // las celdas contiguas iguales en un unico rango.
    for (let row = firstDataRow; row <= lastDataRow; row += 1) {
      sheet.getCell(row, validation.column).dataValidation = rule;
    }
  }
}

/**
 * Genera y descarga un .xlsx con el logo de DCredits, titulos destacados,
 * encabezado con color de marca, bordes, panel congelado y filtro automatico.
 */
export async function downloadXlsx(input: XlsxExportInput): Promise<void> {
  const ExcelJS = await loadExcelJs();
  const rows = input.rows.map((row) => row.map((cell) => String(cell ?? '')));
  const blankIndex = rows.findIndex(isEmptyRow);
  const headerIndex = detectHeaderIndex(rows);
  const header = headerIndex >= 0 ? rows[headerIndex] : [];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(input.sheetName ?? 'DCredits');

  const logoBase64 = await loadLogoBase64();
  if (logoBase64) {
    const logoId = workbook.addImage({ base64: logoBase64, extension: 'png' });
    sheet.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: LOGO_WIDTH, height: LOGO_HEIGHT },
    });
  }

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(HEADER_OFFSET + index + 1);
    const isData = headerIndex >= 0 && index > headerIndex;
    const isHeader = index === headerIndex;
    // El encabezado manda sobre los estilos de titulo: si la plantilla empieza
    // por el encabezado (sin filas decorativas), el texto va blanco sobre la
    // banda de marca y no del mismo color que el fondo.
    const isTitle = index === 0 && !isHeader;
    const isSubtitle = index === 1 && !isHeader;
    const isSectionLabel = blankIndex >= 0 && index > blankIndex && !isHeader && row.length === 1;
    const isMeta = blankIndex >= 0 && index < blankIndex;
    const isMetaLabel = isMeta && row.length > 1;

    row.forEach((value, column) => {
      const cell = excelRow.getCell(column + 1);
      const headerLabel = header[column] ?? '';
      const isNumeric = isData && NUMERIC_HEADERS.has(headerLabel) && NUMBER_PATTERN.test(value);

      cell.value = isNumeric ? Number(value) : value;
      cell.font = {
        name: FONT,
        size: isTitle ? 14 : isSubtitle || isHeader ? 11 : 10,
        bold: isTitle || isSubtitle || isHeader || isSectionLabel || (isMetaLabel && column === 0),
        color: isTitle ? { argb: BRAND } : isHeader ? { argb: 'FFFFFFFF' } : { argb: TEXT },
      };

      if (isHeader) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      } else if (isData) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      }

      if (isData || isHeader) {
        applyBorders(cell);
      }
    });
  });

  let headerRowNumber = -1;

  if (headerIndex >= 0) {
    headerRowNumber = HEADER_OFFSET + headerIndex + 1;
    const count = Math.max(header.length, 1);

    sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }];
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: count },
    };

    sheet.getRow(headerRowNumber).height = 30;
  }

  // Hojas de catalogo + listas desplegables: evitan que se escriban valores
  // que la importacion no podria resolver (escuelas y sedes, por ejemplo).
  const catalogSheets = input.catalogSheets ?? [];
  for (const catalog of catalogSheets) {
    addCatalogSheet(workbook, catalog);
  }

  if (
    headerRowNumber > 0 &&
    input.listValidations &&
    input.listValidations.length > 0 &&
    catalogSheets.length > 0
  ) {
    applyListValidations(
      sheet,
      headerRowNumber,
      input.listValidations,
      catalogSheets,
      input.validationRows ?? 1000,
    );
  }

  applyColumnWidths(sheet, rows);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  // El nombre siempre termina en .xlsx: sin extension el navegador guarda el
  // archivo como "sin tipo" y luego el input de importacion lo rechaza.
  const downloadName = input.fileName
    .replace(/\.csv$/i, '')
    .replace(/\.xlsx?$/i, '');
  anchor.download = `${downloadName}.xlsx`;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
