export type EventStatus = 'Programado' | 'En curso' | 'Finalizado' | 'Cancelado';
export type EventModality = 'Presencial' | 'Virtual' | 'Híbrido';

export const EVENT_MODALITIES = ['Presencial', 'Virtual', 'Híbrido'] as const;
export const EVENT_STATUSES = ['Programado', 'En curso', 'Finalizado', 'Cancelado'] as const;

/** Tipos de evento academico soportados por DCredits. */
export const EVENT_TYPES = [
  'Congreso',
  'Seminario',
  'Taller',
  'Curso',
  'Foro',
  'Conferencia',
  'Webinar',
  'Muestra',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface AcademicEvent {
  id: string;
  code: string;
  name: string;
  description?: string;
  eventType: EventType;

  /** ISO date-time. */
  startDate: string;
  /** ISO date-time. Siempre >= startDate. Puede ser el mismo dia. */
  endDate: string;

  modality: EventModality;
  location?: string;
  status: EventStatus;
  capacity?: number | null;
  organizer?: string;

  /** Creditos que otorga el evento a cada participante. */
  credits: number;

  tags?: string[];

  // --- Estado de importacion de participantes ---

  /**
   * ISO date-time en que la organizacion cerro la carga de la lista.
   *
   * Mientras no exista, el evento permanece abierto: se pueden registrar
   * participaciones (manual o por importacion). Cuando existe, el registro queda
   * CERRADO y solo se reabre habilitando cargas extemporaneas.
   */
  importCompletedAt?: string | null;

  /** Persona que marco la carga como completa. */
  importCompletedBy?: string | null;

  /** true cuando la carga se cerro: es el indicador de "Registro cerrado". */
  importLocked?: boolean;

  /**
   * ISO date-time en que se habilitaron las cargas extemporaneas.
   *
   * null significa que NO estan habilitadas: el evento sigue cerrado. Con valor,
   * el evento entra en modo LATE y admite subir una lista posterior.
   */
  lateImportsEnabledAt?: string | null;

  /** Persona que habilito las cargas extemporaneas. */
  lateImportsEnabledBy?: string | null;

  /** Motivo declarado al habilitar las cargas extemporaneas. */
  lateImportsReason?: string | null;

  /** Ultimo lote de importacion normal confirmado. */
  importBatchId?: string | null;

  /** Ultimo lote de importacion extemporanea confirmado. */
  lateImportBatchId?: string | null;

  /** Persona que subio la ultima lista (normal o extemporanea). */
  importUploadedBy?: string | null;
}

export interface EventDraft {
  code?: string;
  name: string;
  description: string;
  eventType: EventType;
  startDate: string;
  endDate: string;
  modality: EventModality;
  location: string;
  status: EventStatus;
  capacity: number | null;
  organizer: string;
  credits: number;
  tags: string[];
}

export interface EventValidation {
  valid: boolean;
  errors: Partial<Record<keyof EventDraft, string>>;
}

const DAY_MS = 86_400_000;

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Un evento puede durar 1 dia o varios. No se impone ningun limite artificial
 * de duracion: solo se valida que el fin no sea anterior al inicio. */
export function isMultiDayEvent(event: Pick<AcademicEvent, 'startDate' | 'endDate'>): boolean {
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  if (!start || !end) {
    return false;
  }
  return end.getTime() - start.getTime() >= DAY_MS;
}

/** "15/10/2026" para un dia, "15/10/2026 - 18/10/2026" para varios. */
export function eventDateRangeLabel(
  event: Pick<AcademicEvent, 'startDate' | 'endDate'>,
  locale = 'es'
): string {
  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  if (!start || !end) {
    return '';
  }
  const short = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const from = short.format(start);
  const to = short.format(end);
  return isMultiDayEvent(event) ? `${from} - ${to}` : from;
}

/** true solo si el evento esta cancelado y no admite nuevas participaciones. */
export function acceptsParticipations(event: AcademicEvent): boolean {
  return event.status !== 'Cancelado';
}

/**
 * true cuando la lista de participantes ya fue cerrada.
 *
 * Es un estado distinto de "cancelado": el evento existio y acredita creditos,
 * pero ya no admite registros nuevos por la via normal.
 */
export function isImportCompleted(event: AcademicEvent): boolean {
  return Boolean(event.importCompletedAt);
}

/**
 * true cuando el evento esta cerrado pero se reabrieron las cargas
 * extemporaneas: admite una lista posterior (modo LATE).
 */
export function isLateImportsEnabled(event: AcademicEvent): boolean {
  return isImportCompleted(event) && Boolean(event.lateImportsEnabledAt);
}

/**
 * true si el evento admite registrar participantes AHORA.
 *
 * Es la regla que decide si el formulario manual, el asistente de importacion y
 * `ParticipationService.register()` deben operar. No confundir con
 * `acceptsParticipations()`, que solo dice si el evento fue cancelado: un evento
 * cerrado sigue siendo "no cancelado" y aun asi su registro esta cerrado.
 */
export function isRegistrationOpen(event: AcademicEvent): boolean {
  if (!acceptsParticipations(event)) {
    return false;
  }
  return !isImportCompleted(event) || isLateImportsEnabled(event);
}

/**
 * Estado de la carga de participantes, calculado por el sistema.
 *
 * No lo marca el usuario: se deduce de si ya existe la primera carga y de si hay
 * una recarga autorizada.
 */
export type EventLoadState =
  /** Todavia no se subio la primera lista. El registro esta abierto. */
  | 'SIN_PRIMERA_CARGA'
  /** La primera carga ya existe: el registro quedo cerrado. */
  | 'PRIMERA_CARGA_REALIZADA'
  /** Se aprobo una solicitud y hay una recarga (lista posterior) habilitada. */
  | 'RECARGA_HABILITADA';

export const EVENT_LOAD_STATE_LABEL: Record<EventLoadState, string> = {
  SIN_PRIMERA_CARGA: 'Sin primera carga',
  PRIMERA_CARGA_REALIZADA: 'Primera carga realizada',
  RECARGA_HABILITADA: 'Recarga habilitada',
};

export function eventLoadState(event: AcademicEvent): EventLoadState {
  if (isLateImportsEnabled(event)) {
    return 'RECARGA_HABILITADA';
  }
  return isImportCompleted(event) ? 'PRIMERA_CARGA_REALIZADA' : 'SIN_PRIMERA_CARGA';
}

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  Congreso: 'Congreso',
  Seminario: 'Seminario',
  Taller: 'Taller',
  Curso: 'Curso',
  Foro: 'Foro',
  Conferencia: 'Conferencia',
  Webinar: 'Webinar',
  Muestra: 'Muestra',
};
