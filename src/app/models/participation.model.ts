import type { AcademicEvent } from './academic-event.model';
import type { Student } from './student.model';

/**
 * RELACION ESTUDIANTE <-> EVENTO.
 *
 * Todo lo que depende de un evento vive aqui: tipo de participacion, fecha,
 * creditos, nota y los codigos del certificado: el vigente de DCredits y, para
 * los registros migrados, el que emitia el sistema anterior.
 */
export type ParticipationStatus = 'VALID' | 'CANCELLED' | 'PENDING';

export const PARTICIPATION_TYPES = [
  'ASISTENTE',
  'PONENTE',
  'PANELISTA',
  'INVITADO',
  'ORGANIZADOR',
] as const;

export type ParticipationType = (typeof PARTICIPATION_TYPES)[number];

export interface Participation {
  id: string;

  eventId: string;
  studentId: string;

  participationType: ParticipationType;
  participationDate: string;

  credits: number;

  /**
   * Codigo unico de DCredits (p. ej. "DC-2026-Y6GQ4L"), con la nomenclatura
   * vigente. Lo genera el servidor una sola vez y no cambia aunque se anule la
   * participacion o se exporte.
   *
   * null SOLO en participaciones migradas desde el sistema anterior que todavia
   * no tienen codigo DC asignado: para esas existe `legacyCode`.
   */
  verificationCode: string | null;

  /**
   * Codigo del certificado emitido por el sistema ANTERIOR.
   *
   * Trae su propia nomenclatura (letras, guiones, caracteres especiales) y se
   * conserva tal cual, porque es el codigo que el estudiante ya conoce. Nunca
   * se convierte al formato DC.
   */
  legacyCode: string | null;

  /** Nota opcional. null / undefined significa "sin nota registrada", no 0. */
  grade?: number | null;

  status: ParticipationStatus;

  /**
   * Origen de la carga que registro esta participacion.
   *
   * NORMAL es el registro regular (primera carga). LATE marca los registros
   * que llegaron por una RECARGA: una lista posterior autorizada mediante una
   * solicitud de carga. Es la etiqueta que permite identificar los
   * extemporaneos.
   *
   * Opcional para no romper los registros historicos: la ausencia se interpreta
   * como NORMAL.
   */
  importMode?: ParticipationImportMode;
}

/** Datos-ingreso de una participacion. El repositorio asigna id, fecha y verificationCode. */
export interface ParticipationDraft {
  eventId: string;
  studentId: string;
  participationType: ParticipationType;
  credits: number;
  grade?: number | null;
  /** Codigo del sistema anterior, cuando se esta reingresando un certificado historico. */
  legacyCode?: string | null;
  /** Origen de la carga. Si se omite, el servicio lo deduce del estado del evento. */
  importMode?: ParticipationImportMode;
}

export interface ParticipationEdit {
  participationType?: ParticipationType;
  credits?: number;
  grade?: number | null;
  status?: ParticipationStatus;
}

/** Participacion con su evento y su estudiante resueltos, para vistas y exportes. */
export interface ParticipationContext {
  participation: Participation;
  event: AcademicEvent | undefined;
  student: Student | undefined;
}

/**
 * Filtros de ParticipationService.getParticipations() y getParticipationsPage().
 *
 * Mapean 1:1 con los query params de GET /participations.
 */
export interface ParticipationQuery {
  eventId?: string;
  studentId?: string;
  status?: ParticipationStatus;
  participationType?: ParticipationType;
  search?: string;
  /** Solo certificables: participaciones que pueden generar un certificado. */
  withCertificateOnly?: boolean;
  /** Solo pendientes de migrar: tienen codigo anterior pero todavia no DC. */
  pendingMigrationOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: ParticipationSortKey;
}

/** Ordenes de la tabla de participaciones. */
export type ParticipationSortKey = 'recent' | 'student' | 'event' | 'credits';

export const PARTICIPATION_SORT_OPTIONS: { value: ParticipationSortKey; label: string }[] = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'student', label: 'Estudiante (A-Z)' },
  { value: 'event', label: 'Evento (A-Z)' },
  { value: 'credits', label: 'Créditos (mayor a menor)' },
];

/** Tamaños de página ofrecidos. */
export const PARTICIPATION_PAGE_SIZES = [25, 50, 100, 200] as const;

export const DEFAULT_PARTICIPATION_PAGE_SIZE = 25;

/**
 * Resultado paginado de participaciones.
 *
 * El historial real tiene mas de un millón de participaciones: la vista NUNCA
 * recibe la lista completa, solo la pagina que muestra y el total real.
 */
export interface ParticipationPage {
  items: Participation[];
  /** Total que cumple los filtros, no los de la pagina. */
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  /** Primer y ultimo indice (1-based) mostrado; 0 si la pagina esta vacia. */
  from: number;
  to: number;
}

/**
 * Cifras de las tarjetas de resumen, calculadas sobre TODO lo que cumple los
 * filtros y no solo sobre la pagina visible.
 *
 * Sin esto, los numeros de la cabecera cambiarian al paginar y dejarian de
 * describir el conjunto que la persona esta mirando.
 */
export interface ParticipationSummary {
  total: number;
  valid: number;
  cancelled: number;
  pending: number;
  /** Sumatoria de creditos de las participaciones vigentes. */
  totalCredits: number;
  /** Vigentes todavia sin nota registrada. */
  pendingGrades: number;
  /** Vigentes con algun codigo de certificado que se pueda consultar. */
  withCertificate: number;
  /** Con codigo anterior y sin codigo DC: pendientes de migrar. */
  pendingMigration: number;
}

/** Una participacion solo suma creditos cuando esta vigente. */
export function countsForCredits(participation: Participation): boolean {
  return participation.status === 'VALID';
}

/** Resultado de pedir el codigo DC para un certificado del sistema anterior. */
export type CodeReissueOutcome =
  /** Se genero un codigo DC nuevo; el anterior sigue guardado. */
  | 'CREATED'
  /** La participacion ya tenia codigo DC: no se vuelve a generar. */
  | 'ALREADY_MIGRATED'
  /** La participacion esta anulada: no se emiten codigos. */
  | 'CANCELLED'
  /** No existe la participacion indicada. */
  | 'NOT_FOUND';

export interface CodeReissueResult {
  outcome: CodeReissueOutcome;
  participation?: Participation;
  /** Codigo DC recien generado, si se genero. */
  verificationCode?: string | null;
  /** Codigo del sistema anterior que se conserva, si lo habia. */
  legacyCode?: string | null;
  message: string;
}

/**
 * Modo de una carga de lista de participantes.
 *
 * NORMAL es la carga mientras el evento esta abierto. LATE es la lista subida
 * despues de cerrar la carga, con autorizacion explicita de un responsable.
 */
export type ParticipationImportMode = 'NORMAL' | 'LATE';

export const IMPORT_MODE_LABEL: Record<ParticipationImportMode, string> = {
  NORMAL: 'Carga regular',
  LATE: 'Carga extemporánea (subida posterior)',
};

/** Una participacion es extemporanea cuando llego por una recarga (LATE). */
export function isLateParticipation(participation: Participation): boolean {
  return participation.importMode === 'LATE';
}

/**
 * ESTADOS DE UNA SOLICITUD DE CARGA (recarga).
 *
 * La solicitud llega por un canal EXTERNO; DCredits no la origina, solo registra
 * que existe y resuelve su estado. Una solicitud aprobada habilita la recarga
 * del evento (una lista posterior, modo LATE).
 */
export type LoadRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const LOAD_REQUEST_STATUS_LABEL: Record<LoadRequestStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

/**
 * SOLICITUD DE CARGA.
 *
 * Peticion (externa) para subir una lista adicional una vez cerrada la primera
 * carga. La solicitud LLEVA LA CARGA ADJUNTA: quien la pide sube los codigos de
 * la lista extemporanea y declara el motivo por el que llego tarde. Un
 * responsable la aprueba o la rechaza; al aprobarla, esa carga queda registrada
 * y se sella el lote extemporaneo.
 */
export interface ParticipationLoadRequest {
  id: string;
  eventId: string;
  /** Solicitante externo: persona o area que sube la lista y pide la recarga. */
  requestedBy: string;
  /** Motivo por el que la lista llego despues del cierre. */
  reason: string;
  /** Codigos universitarios de la lista extemporanea adjunta. */
  codes: string[];
  /** Nombre del archivo de origen, si la carga vino de un archivo. */
  fileName?: string | null;
  /** ISO date-time en que se recibio la solicitud. */
  requestedAt: string;
  status: LoadRequestStatus;
  /** Persona que aprobo o rechazo la solicitud. */
  resolvedBy?: string | null;
  /** ISO date-time de la resolucion. */
  resolvedAt?: string | null;
  /** Nota de la resolucion (motivo de aprobacion o rechazo). */
  resolutionNote?: string | null;
  /** Lote extemporaneo generado al aprobar la solicitud. */
  batchId?: string | null;
  /** Participaciones registradas al aprobar la carga adjunta. */
  registeredCount?: number | null;
  /** Codigos omitidos (no encontrados o ya registrados) al aprobar. */
  skippedCount?: number | null;
}

/** Datos-ingreso de una solicitud de carga. El servicio asigna id, fecha y estado. */
export interface ParticipationLoadRequestDraft {
  eventId: string;
  requestedBy: string;
  reason: string;
  codes: string[];
  fileName?: string | null;
}

/**
 * Lote de importacion confirmado.
 *
 * Guarda la trazabilidad completa de cada carga: quien subio la lista, cuando,
 * cuantas participaciones registro y, en modo LATE, quien autorizo la
 * extemporaneidad, cuando y con que motivo.
 */
export interface ParticipationImportBatch {
  id: string;
  eventId: string;
  mode: ParticipationImportMode;
  /** ISO date-time de la confirmacion. */
  createdAt: string;
  /** Persona que subio la lista. */
  uploadedBy: string;
  total: number;
  registered: number;
  skipped: number;
  /** Autorizacion de la carga extemporanea (solo modo LATE). */
  lateEnabledBy?: string | null;
  lateEnabledAt?: string | null;
  lateReason?: string | null;
}

export const PARTICIPATION_STATUS_LABEL: Record<ParticipationStatus, string> = {
  VALID: 'Vigente',
  CANCELLED: 'Anulada',
  PENDING: 'Pendiente',
};

export const PARTICIPATION_TYPE_LABEL: Record<ParticipationType, string> = {
  ASISTENTE: 'Asistente',
  PONENTE: 'Ponente',
  PANELISTA: 'Panelista',
  INVITADO: 'Invitado',
  ORGANIZADOR: 'Organizador',
};
