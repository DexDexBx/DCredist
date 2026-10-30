import { Injectable, inject } from '@angular/core';
import {
  AcademicEvent,
  ExportResult,
  INSTITUTIONAL_EVENT_METADATA_LABELS,
  INSTITUTIONAL_EXPORT_COLUMNS,
  ParticipationContext,
  ParticipationQuery,
  ParticipationStatus,
  eventDateRangeLabel,
  isMultiDayEvent,
  primaryCertificateCode,
} from '../../models';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';
import { collateCodes } from '../../shared/utils/text.utils';
import {
  buildCsv,
  buildFileName,
  formatCredits,
  formatGrade,
  optionalText,
} from '../../shared/utils/csv.utils';
import { downloadXlsx } from '../../shared/utils/xlsx.utils';

const INSTITUTIONAL_DELIMITER = ';';
const CSV_MIME = 'text/csv;charset=utf-8';

/**
 * SERVICIO - EXPORTACION DE PARTICIPANTES.
 *
 * Un unico formato, el institucional: respeta EXACTAMENTE el formato requerido
 * por la institucion. Encabezado de metadatos + columnas obligatorias + filas.
 * Sus columnas no se pueden alterar.
 *
 *       N° ; CÓDIGO UNIVERSITARIO ; GRADO ACADEMICO ; APELLIDOS ; NOMBRES ;
 *       ESCUELA PROFESIONAL ; TIPO DE PARTICIPACIÓN ; CÓDIGO DEL CERTIFICADO ;
 *       NÚMERO DE CRÉDITOS ; NOTA ; SEDE
 *
 * El "CÓDIGO DEL CERTIFICADO" es el codigo unico de DCredits
 * (DC-2026-XXXXXX): es el dato que se envia para generar los certificados.
 *
 * Contrato de API: GET /events/:id/export
 */
@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly eventService = inject(EventService);
  private readonly participationService = inject(ParticipationService);
  private readonly studentService = inject(StudentService);

  /**
   * Nombre definitivo del reporte: el archivo que se descarga es .xlsx,
   * aunque por dentro se mantenga tambien la matriz CSV de respaldo.
   */
  private exportFileName(parts: (string | undefined | null)[]): string {
    return buildFileName(parts, 'xlsx');
  }

  /**
   * Descarga el reporte como .xlsx (logo DCredits, encabezado con color de marca,
   * panel congelado y filtro). La promesa no se observa: la vista conserva el
   * ExportResult para mostrar el nombre del archivo y el total de filas.
   */
  private download(result: ExportResult): void {
    const sheetName = result.fileName.replace(/\.[^.]+$/, '').slice(0, 31);
    void downloadXlsx({ fileName: result.fileName, rows: result.rows, sheetName }).catch(
      () => undefined
    );
  }

  exportEventParticipants(eventId: string): ExportResult | null {
    const event = this.eventService.findById(eventId);
    if (!event) {
      return null;
    }

    return this.buildInstitutional(event);
  }

  downloadEventParticipants(eventId: string): ExportResult | null {
    const result = this.exportEventParticipants(eventId);
    if (!result) {
      return null;
    }

    this.download(result);

    return result;
  }

  /** Vista previa del archivo institucional sin descargarlo. */
  previewInstitutional(eventId: string, limit = 8): string[][] {
    const event = this.eventService.findById(eventId);
    if (!event) {
      return [];
    }

    return [
      ...this.metadataRows(event),
      [...INSTITUTIONAL_EXPORT_COLUMNS],
      ...this.institutionalRows(event).slice(0, limit),
    ];
  }

  /** Etiqueta legible del rango de fechas del evento, reutilizada por la interfaz. */
  eventDateLabel(event: AcademicEvent): string {
    return eventDateRangeLabel(event);
  }

  /** Padron completo de una escuela: base de la consulta institucional. */
  exportSchoolStudents(professionalSchool: string): ExportResult {
    const students = this.studentService
      .getStudents({ professionalSchool })
      .filter((student) => student.status === 'ACTIVE');

    const header = [
      'CÓDIGO UNIVERSITARIO',
      'GRADO ACADEMICO',
      'APELLIDOS',
      'NOMBRES',
      'ESCUELA PROFESIONAL',
      'SEDE',
      'ESTADO',
    ];

    const table = [
      ['DCredits'],
      ['PADRON DE ESTUDIANTES'],
      ['Escuela profesional:', professionalSchool],
      ['Total de estudiantes:', String(students.length)],
      [],
      header,
      ...students.map((student) => [
        student.universityCode,
        student.academicDegree,
        student.lastName,
        student.firstName,
        student.professionalSchool,
        student.headquarters,
        student.status,
      ]),
    ];

    return {
      fileName: this.exportFileName(['DCredits', 'padron', professionalSchool]),
      mimeType: CSV_MIME,
      content: buildCsv(table, INSTITUTIONAL_DELIMITER),
      rows: table,
      rowCount: students.length,
    };
  }

  /** Las participaciones anuladas no forman parte de los reportes. */
  private isExportable(status: ParticipationStatus): boolean {
    return status !== 'CANCELLED';
  }

  private metadataRows(event: AcademicEvent): string[][] {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const multiDay = isMultiDayEvent(event);
    const formatter = new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const values: Record<string, string> = {
      'Código del evento': event.code,
      'Nombre del evento': event.name,
      'Tipo de evento': event.eventType,
      'Fecha de inicio': formatter.format(start),
      'Fecha de término': formatter.format(multiDay ? end : start),
      Modalidad: event.modality,
      Lugar: optionalText(event.location),
      Organizador: optionalText(event.organizer),
      Créditos: formatCredits(event.credits),
      Estado: event.status,
    };

    const rows: string[][] = [
      ['DCredits'],
      ['REPORTE DE PARTICIPANTES'],
    ];

    INSTITUTIONAL_EVENT_METADATA_LABELS.forEach((label) => {
      rows.push([`${label}:`, values[label] ?? '']);
    });

    rows.push([]);
    return rows;
  }

  /** Filas del archivo institucional del evento, ordenadas por codigo. */
  private institutionalRows(event: AcademicEvent): string[][] {
    return this.getEventTable(event.id)
      .filter((item) => item.student && this.isExportable(item.participation.status))
      .sort((a, b) =>
        collateCodes(a.student?.universityCode, b.student?.universityCode)
      )
      .map((item, index) => this.institutionalRow(item, index + 1));
  }

  private buildInstitutional(event: AcademicEvent): ExportResult {
    const rows = this.institutionalRows(event);
    const table = [
      ...this.metadataRows(event),
      [...INSTITUTIONAL_EXPORT_COLUMNS],
      ...rows,
    ];

    return {
      fileName: this.exportFileName(['DCredits', event.code, 'participantes']),
      mimeType: CSV_MIME,
      content: buildCsv(table, INSTITUTIONAL_DELIMITER),
      rows: table,
      rowCount: rows.length,
    };
  }

  /**
   * LISTA DE CERTIFICADOS DE TODAS LAS PARTICIPACIONES FILTRADAS.
   *
   * Es el mismo archivo institucional que se genera por evento, pero tomando lo
   * que hay filtrado en el listado de participaciones en vez de un evento.
   * Sirve para enviar a imprimir un lote de certificados.
   *
   * Las participaciones anuladas no entran: no se emite nada por una anulacion.
   *
   * Contrato de API: GET /participations/export
   */
  exportParticipationList(query: ParticipationQuery = {}): ExportResult {
    const rows = this.participationService
      .getParticipations({ ...query, sort: 'student' })
      .filter((participation) => this.isExportable(participation.status))
      .map((participation) => this.participationService.context(participation));

    return this.buildListInstitutional(rows, query);
  }

  downloadParticipationList(query: ParticipationQuery = {}): ExportResult {
    const result = this.exportParticipationList(query);

    this.download(result);

    return result;
  }

  /** Exporta y descarga el padron de una escuela. */
  downloadSchoolStudents(professionalSchool: string): ExportResult {
    const result = this.exportSchoolStudents(professionalSchool);
    this.download(result);
    return result;
  }

  /**
   * LISTADO DE EVENTOS.
   *
   * Exporta los eventos que la vista tiene filtrados, con su cupo y el conteo
   * de participantes vigentes. Es un reporte de gestion, no de participacion.
   *
   * Contrato de API: GET /events/export
   */
  exportEventsList(events: AcademicEvent[]): ExportResult {
    const header = [
      'CÓDIGO',
      'NOMBRE',
      'TIPO',
      'MODALIDAD',
      'FECHA DE INICIO',
      'FECHA DE TÉRMINO',
      'LUGAR',
      'ORGANIZADOR',
      'CRÉDITOS',
      'CUPO',
      'PARTICIPANTES',
      'ESTADO',
    ];

    const dateFormatter = new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const body = events.map((event) => [
      event.code,
      event.name,
      event.eventType,
      event.modality,
      dateFormatter.format(new Date(event.startDate)),
      dateFormatter.format(new Date(event.endDate)),
      optionalText(event.location),
      optionalText(event.organizer),
      formatCredits(event.credits),
      event.capacity ? String(event.capacity) : '',
      String(this.participationService.countForEvent(event.id, true)),
      event.status,
    ]);

    const table: string[][] = [
      ['DCredits'],
      ['LISTADO DE EVENTOS'],
      ['Total de eventos:', String(events.length)],
      [],
      header,
      ...body,
    ];

    return {
      fileName: this.exportFileName(['DCredits', 'eventos']),
      mimeType: CSV_MIME,
      content: buildCsv(table, INSTITUTIONAL_DELIMITER),
      rows: table,
      rowCount: events.length,
    };
  }

  downloadEventsList(events: AcademicEvent[]): ExportResult {
    const result = this.exportEventsList(events);
    this.download(result);
    return result;
  }

  /**
   * Encabezado del archivo: deja claro que es un recorte de lo filtrado, para que
   * quien lo recibe sepa que no es el total del historial.
   */
  private listMetadataRows(query: ParticipationQuery, total: number): string[][] {
    const rows: string[][] = [
      ['DCredits'],
      ['LISTA DE CERTIFICADOS'],
    ];

    const label = 'Sin filtro';
    const eventName = query.eventId ? this.eventService.findById(query.eventId)?.name : undefined;

    rows.push(['Origen:', eventName ? `Evento ${eventName}` : label]);
    rows.push(['Total de participaciones:', String(total)]);
    rows.push([]);
    return rows;
  }

  /** Columnas del archivo institucional para un conjunto de participaciones. */
  private institutionalRow(item: ParticipationContext, index: number): string[] {
    const student = item.student;
    const participation = item.participation;

    return [
      String(index + 1),
      student?.universityCode ?? '',
      student?.academicDegree ?? '',
      student?.lastName ?? '',
      student?.firstName ?? '',
      student?.professionalSchool ?? '',
      participation.participationType,
      primaryCertificateCode(participation) ?? '',
      formatCredits(participation.credits),
      formatGrade(participation.grade),
      student?.headquarters ?? '',
    ];
  }

  private buildListInstitutional(
    rows: ParticipationContext[],
    query: ParticipationQuery
  ): ExportResult {
    const body = rows.map((item, index) => this.institutionalRow(item, index + 1));
    const table = [
      ...this.listMetadataRows(query, body.length),
      [...INSTITUTIONAL_EXPORT_COLUMNS],
      ...body,
    ];

    return {
      fileName: this.exportFileName(['DCredits', 'certificados']),
      mimeType: CSV_MIME,
      content: buildCsv(table, INSTITUTIONAL_DELIMITER),
      rows: table,
      rowCount: body.length,
    };
  }

  /** Participaciones del evento con evento y estudiante resueltos. */
  private getEventTable(eventId: string): ParticipationContext[] {
    return this.participationService.getEventTable(eventId);
  }

  /** Solo para diagnostico: codigos de participacion del evento, de cualquier nomenclatura. */
  verificationCodes(eventId: string): string[] {
    return this.participationService
      .getEventTable(eventId)
      .filter((item) => this.isExportable(item.participation.status))
      .map((item) => primaryCertificateCode(item.participation))
      .filter((code): code is string => Boolean(code));
  }
}
