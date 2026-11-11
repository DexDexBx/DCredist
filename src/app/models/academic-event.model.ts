export type EventStatus = 'Programado' | 'En curso' | 'Finalizado' | 'Cancelado';
export type EventModality = 'Presencial' | 'Virtual' | 'Híbrido' | 'No especificado';

export const EVENT_MODALITIES = [
  'Presencial',
  'Virtual',
  'Híbrido',
  'No especificado',
] as const;
export const EVENT_STATUSES = ['Programado', 'En curso', 'Finalizado', 'Cancelado'] as const;

/**
 * Nombre visible del evento, sin espacios sobrantes.
 *
 * La unicidad de nombres se evalua sin distinguir mayusculas: el backend y la
 * base aplican el mismo criterio.
 */
export function normalizeEventName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Procedencia de un evento.
 *
 * CURRENT: registro nuevo con sus datos completos. LEGACY: data historica
 * migrada; admite campos opcionales con valores por defecto.
 */
export type EventOrigin = 'CURRENT' | 'LEGACY';

export const EVENT_ORIGIN_LABEL: Record<EventOrigin, string> = {
  CURRENT: 'Registro actual',
  LEGACY: 'Registro histórico',
};

/**
 * Precision de la fecha del evento.
 *
 * LONG: dia, mes y anio (fecha completa).
 * SHORT: solo mes y anio; el dia se guarda internamente como 29.
 */
export type EventDateType = 'LONG' | 'SHORT';

export const EVENT_DATE_TYPE_LABEL: Record<EventDateType, string> = {
  LONG: 'Fecha completa',
  SHORT: 'Solo mes y año',
};

/**
 * Fecha sentinela de los eventos historicos sin fecha (29-09-1999).
 *
 * La base conserva las columnas DATE; en lugar de NULL se guarda este valor, que
 * la interfaz interpreta como "Sin fecha".
 */
export const HISTORICAL_EVENT_DATE = '1999-09-29';

/** true si la fecha es la sentinela de "sin fecha" de un registro historico. */
export function isHistoricalEventDate(value: string | null | undefined): boolean {
  return (value ?? '').startsWith(HISTORICAL_EVENT_DATE);
}

/**
 * Traduccion de los tipos de evento.
 *
 * La base guarda el nombre en ingles (`event_types.name`); la interfaz muestra
 * siempre el nombre en espanol. Si aparece un tipo nuevo sin traduccion se usa
 * el nombre original como respaldo.
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  congress: 'Congreso',
  seminar: 'Seminario',
  workshop: 'Taller',
  course: 'Curso',
  forum: 'Foro',
  conference: 'Conferencia',
  webinar: 'Webinar',
  exhibition: 'Muestra',
  unspecified: 'No especificado',
};

export function eventTypeLabel(name: string | null | undefined): string {
  const key = (name ?? '').trim().toLowerCase();
  return EVENT_TYPE_LABELS[key] ?? (name?.trim() || 'Sin tipo');
}

export interface AcademicEvent {
  id: number;
  code: string;
  name: string;
  description?: string;
  /** Id del tipo de evento en `event_types`. */
  eventTypeId: number;
  /** Nombre del tipo tal como llega del API (en ingles). */
  eventTypeName: string;

  /** Fecha calendario (YYYY-MM-DD). */
  startDate: string;
  /** Fecha calendario (YYYY-MM-DD). Siempre >= startDate. Puede ser el mismo dia. */
  endDate: string;

  modality: EventModality;
  location?: string;
  status: EventStatus;
  /** 0 significa sin limite de participantes. */
  capacity: number;

  /** Id y nombre del organizador en el catalogo. */
  organizerId: number;
  organizer: string;

  /** Escuela profesional duena del evento: delimita su alcance. */
  professionalSchoolId: number;
  professionalSchool: string;

  /** Procedencia del registro: actual o historico. */
  origin?: EventOrigin;

  /** Usuario que creo el evento y que lo modifico por ultima vez. */
  userCreate: string;
  userUpdate: string;

  /** Creditos que otorga el evento a cada participante. */
  credits: number;

  /** Precision de las fechas: fecha completa o solo mes y anio. */
  dateType?: EventDateType;

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
  eventTypeId: number | null;
  startDate: string;
  endDate: string;
  modality: EventModality;
  location: string;
  status: EventStatus;
  capacity: number;
  organizerId: number | null;
  professionalSchoolId: number | null;
  credits: number;
  /** CURRENT (por defecto) o LEGACY. */
  origin?: EventOrigin;
  /** LONG (fecha completa) o SHORT (solo mes y anio). */
  dateType?: EventDateType;
}

export interface EventValidation {
  valid: boolean;
  errors: Partial<Record<keyof EventDraft, string>>;
}

const DAY_MS = 86_400_000;

function toDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

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
  event: Pick<AcademicEvent, 'startDate' | 'endDate' | 'dateType'>,
  locale = 'es'
): string {
  if (isHistoricalEventDate(event.startDate) || isHistoricalEventDate(event.endDate)) {
    return 'Sin fecha';
  }

  const start = toDate(event.startDate);
  const end = toDate(event.endDate);
  if (!start || !end) {
    return '';
  }

  // Fecha de solo mes y anio: no se muestra el dia.
  if (event.dateType === 'SHORT') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
    }).format(start);
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


