import type { ParticipationContext } from './participation.model';
import type { AcademicEvent } from './academic-event.model';
import type { Student } from './student.model';

/**
 * CONTRATO DEL EXPORTE INSTITUCIONAL.
 *
 * El archivo de participantes debe respetar EXACTAMENTE estas columnas y este
 * orden. No se pueden agregar columnas al medio sin romper el formato
 * institucional.
 */

export const INSTITUTIONAL_EXPORT_COLUMNS = [
  'N°',
  'CÓDIGO UNIVERSITARIO',
  'GRADO ACADEMICO',
  'APELLIDOS',
  'NOMBRES',
  'ESCUELA PROFESIONAL',
  'TIPO DE PARTICIPACIÓN',
  'CÓDIGO DEL CERTIFICADO',
  'NÚMERO DE CRÉDITOS',
  'NOTA',
  'SEDE',
] as const;

export type InstitutionalExportColumn = (typeof INSTITUTIONAL_EXPORT_COLUMNS)[number];

/** Metadatos del evento que encabezan el reporte institucional. */
export const INSTITUTIONAL_EVENT_METADATA_LABELS = [
  'Código del evento',
  'Nombre del evento',
  'Tipo de evento',
  'Fecha de inicio',
  'Fecha de término',
  'Modalidad',
  'Lugar',
  'Organizador',
  'Créditos',
  'Estado',
] as const;

export interface ExportRow {
  [key: string]: string;
}

export interface EventExportInput {
  event: AcademicEvent;
  rows: ExportRow[];
  generatedAt: Date;
}

export interface ExportResult {
  fileName: string;
  mimeType: string;
  content: string;
  /** Matriz completa del reporte (encabezado incluido): base del .xlsx. */
  rows: string[][];
  rowCount: number;
}

/** Fila institucional de una participacion, ya resuelta contra el padron. */
export interface InstitutionalParticipantRow {
  index: number;
  participation: ParticipationContext;
  student: Student;
}
