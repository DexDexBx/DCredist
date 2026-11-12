import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_PARTICIPATION_PAGE_SIZE,
  Participation,
  ParticipationContext,
  ParticipationDraft,
  ParticipationEdit,
  ParticipationImportBatch,
  ParticipationImportMode,
  ParticipationOrigin,
  ParticipationPage,
  ParticipationQuery,
  ParticipationSortKey,
  ParticipationStatus,
  ParticipationSummary,
  Student,
  acceptsParticipations,
  codeContains,
  compactCode,
  generateVerificationCode,
  isLateImportsEnabled,
  isRegistrationOpen,
  normalizeLegacyCode,
  normalizeVerificationCode,
  primaryCertificateCode,
  sameCertificateCode,
} from '../../models';
import {
  NAME_COLLATOR,
  codeContainsCompact,
  collateCodes,
  matchesText,
  normalizeForSearch,
} from '../../shared/utils/text.utils';
import { EventService } from './event.service';
import { StudentService } from './student.service';
import {
  mapApiEligibleStudent,
  mapApiParticipation,
  toApiParticipationPayload,
} from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { DataModeService } from './data-mode.service';

/**
 * Texto buscado ya resuelto.
 *
 * `ids` es el conjunto de participaciones que coinciden, o `null` si no se
 * esta buscando nada. Se resuelve una vez por consulta para que el filtro sea
 * una pregunta a un Set y no un recomputo de texto por fila.
 */
interface ParticipationSearch {
  needle: string;
  ids: Set<number> | null;
  /** Coincidencias ya ordenadas por fecha, para no reordenar el historial. */
  items: Participation[] | null;
}

/**
 * Mismos filtros, sin la ventana de pagina.
 *
 * Lo usan el total y el resumen: describen el conjunto completo, y devolverles
 * una pagina truncada los haria mentir sobre cuantos resultados hay.
 */
function withoutPaging(query: ParticipationQuery): ParticipationQuery {
  if (query.page === undefined && query.pageSize === undefined) {
    return query;
  }

  const { page: _page, pageSize: _pageSize, ...filters } = query;
  return filters;
}

export type ParticipationErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'EVENT_CANCELLED'
  | 'EVENT_IMPORT_CLOSED'
  | 'EVENT_FULL'
  | 'STUDENT_NOT_FOUND'
  | 'STUDENT_INACTIVE'
  | 'DUPLICATE'
  | 'INVALID_CREDITS'
  | 'INVALID_GRADE'
  | 'INVALID_CERTIFICATE'
  | 'INVALID_VERIFICATION_CODE'
  | 'VERIFICATION_CODE_TAKEN'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export interface ParticipationResult {
  ok: boolean;
  participation?: Participation;
  error?: ParticipationErrorCode;
  message?: string;
  existing?: Participation;
}

export interface ParticipationImportError {
  row: number;
  code: string;
  reason: string;
}

export interface ParticipationImportStagedItem {
  row: number;
  /** Codigo universitario del estudiante. */
  code: string;
  /** Nota opcional leida del archivo; vacia se normaliza a "sin nota". */
  grade?: string;
  /**
   * Codigo de verificacion original. Solo se informa en cargas historicas
   * (LEGACY); en las actuales lo genera el sistema.
   */
  verificationCode?: string;
  studentId?: number;
  student?: any;
  error?: string;
  valid?: boolean;
}

export interface ParticipationImportStage1Result {
  total: number;
  items: ParticipationImportStagedItem[];
}

export interface ParticipationImportStage2Result {
  total: number;
  valid: number;
  invalid: number;
  items: ParticipationImportStagedItem[];
  errors: ParticipationImportError[];
}

export interface ParticipationImportSummary {
  total: number;
  found: number;
  notFound: string[];
  duplicates: string[];
  registered: number;
  skipped: number;
  errors?: ParticipationImportError[];
  /** Lote confirmado: permite mostrar la trazabilidad de la carga. */
  batchId?: string;
  mode?: ParticipationImportMode;
  uploadedBy?: string;
}

export interface ParticipationImportCommitOptions {
  /** 'NORMAL' mientras el evento esta abierto, 'LATE' cuando se reabrio. */
  mode?: ParticipationImportMode;
  /** CURRENT (por defecto) o LEGACY: la carga conserva los codigos originales. */
  origin?: ParticipationOrigin;
  /** Persona que sube la lista. */
  uploadedBy?: string;
}

/**
 * SERVICE - PARTICIPACIONES.
 *
 * Lee del API (hidratado al arrancar) y escribe contra el backend cuando esta
 * disponible; sin API opera en memoria como antes. Contrato:
 *   GET   /participations?eventId=&studentId=&status=&type=
 *   POST  /participations
 *   PATCH /participations/:id
 *   POST  /participations/import
 *
 * Validaciones de dominio (se aplican antes de tocar el API o el estado local):
 *  - el evento debe existir y no estar cancelado,
 *  - el estudiante debe existir en el padron maestro (NUNCA se crea aqui),
 *  - eventId + studentId es UNIQUE,
 *  - creditos >= 0,
 *  - la nota puede quedar vacia; vacio NO es 0,
 *  - un codigo de certificado no puede repetirse entre participaciones,
 *  - el codigo DC lo asigna el backend; el codigo anterior (sistema previo)
 *    se conserva tal cual cuando se reingresa un certificado historico.
 */
@Injectable({ providedIn: 'root' })
export class ParticipationService {
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);

  private readonly participationsState = signal<Participation[]>([]);

  /** Estudiantes de todas las escuelas, solo para resolver nombres en participaciones. */
  private readonly studentDirectory = signal<Map<number, Student>>(new Map());

  /** Indice por codigo universitario para las importaciones masivas. */
  private readonly studentDirectoryByCode = computed(() => {
    const index = new Map<string, Student>();
    for (const student of this.studentDirectory().values()) {
      index.set(student.universityCode, student);
    }
    return index;
  });

  readonly participations = this.participationsState.asReadonly();

  /** Reemplaza el historial con el que devuelve el API (hidratacion al arrancar). */
  replaceAll(participations: Participation[]): void {
    this.participationsState.set(participations);

    // Aprovecha el estudiante embebido que ya devuelve el listado. Esto resuelve
    // nombres de estudiantes externos sin exponer el padron completo.
    this.studentDirectory.update((current) => {
      const next = new Map(current);
      for (const participation of participations) {
        if (participation.student) {
          next.set(participation.student.id, participation.student);
        }
      }
      return next;
    });
  }

  /** Lotes de importacion confirmados, del mas reciente al mas antiguo. */
  private readonly importBatchesState = signal<ParticipationImportBatch[]>([]);

  readonly importBatches = this.importBatchesState.asReadonly();

  private importBatchSequence = 0;

  /**
   * Indice evento -> participaciones.
   *
   * El gemelo de `participationsByStudent` para el otro lado de la relacion.
   * La tabla de participaciones filtra por evento en casi todas sus vistas, y
   * recorrer el indice del evento answering es infinitamente mas barato que
   * recorrer el millon de participaciones descartando las de otros eventos.
   */
  readonly participationsByEvent = computed(() => {
    const index = new Map<number, Participation[]>();
    for (const participation of this.participationsState()) {
      const bucket = index.get(participation.eventId);
      if (bucket) {
        bucket.push(participation);
      } else {
        index.set(participation.eventId, [participation]);
      }
    }
    return index;
  });

  /**
   * Participaciones ordenadas de la mas reciente a la mas antigua.
   *
   * Es el orden natural de la tabla y el mas consultado, asi que se resuelve una
   * sola vez por version de datos en lugar de ordenar en cada pulsacion.
   */
  readonly participationsByDate = computed(() =>
    [...this.participationsState()].sort((a, b) =>
      b.participationDate.localeCompare(a.participationDate)
    )
  );

  /**
   * Codigos de certificado en forma compacta, en el mismo orden que el historial.
   *
   * Es lo que hace posible buscar un fragmento de codigo sobre 1 200 000 filas.
   * Comparar caracter a caracter costs 300 ms por pulsacion; el `includes` nativo
   * sobre estas cadenas cuesta 45 ms y no crea nada.
   *
   * El separador `|` no puede aparecer en un codigo compacto, asi que una
   * coincidencia nunca puede formarse entre el codigo DC y el anterior de la
   * misma fila. El indice se construye una vez y se reutiliza.
   */
  private readonly compactCodeIndex = computed(() => {
    const separator = '|';
    return this.participationsState().map(
      (participation) =>
        compactCode(participation.verificationCode ?? '') +
        separator +
        compactCode(participation.legacyCode ?? '')
    );
  });

  /**
   * Indice estudiante -> participaciones, agrupadas por id.
   *
   * Es publico porque los reportes de creditos necesitan recorrerlo entero una
   * vez (para acumular el historico) en lugar de preguntar estudiante por
   * estudiante: preguntar de a uno sobre 260 000 filas es 260 000 viajes al
   * indice, y recorrerlo una vez es un solo viaje.
   */
  readonly participationsByStudent = computed(() => {
    const index = new Map<number, Participation[]>();
    for (const participation of this.participationsState()) {
      const bucket = index.get(participation.studentId);
      if (bucket) {
        bucket.push(participation);
      } else {
        index.set(participation.studentId, [participation]);
      }
    }

    // Del evento mas reciente al mas antiguo, igual que getParticipations().
    for (const bucket of index.values()) {
      bucket.sort((a, b) => b.participationDate.localeCompare(a.participationDate));
    }

    return index;
  });

  /** Id de los estudiantes que tienen al menos una participacion registrada. */
  readonly participatingStudentIds = computed(
    () => new Set(this.participationsByStudent().keys())
  );

  readonly totalCredits = computed(() =>
    this.participationsState()
      .filter((participation) => participation.status === 'VALID')
      .reduce((total, participation) => total + participation.credits, 0)
  );

  readonly validCount = computed(
    () => this.participationsState().filter((participation) => participation.status === 'VALID').length
  );

getParticipations(query: ParticipationQuery = {}): Participation[] {
    const items = this.selectParticipations(query, this.resolveSearch(query.search));
    const sort = query.sort ?? 'recent';
    return sort === 'recent'
      ? items
      : this.sortMatches(items, sort, query.sortDirection);
  }

  /**
   * Pagina de participaciones: lo que la tabla pinta, nunca el historial entero.
   *
   * El historial real supera el millon de filas. Recorrerlo entero para descartar
   * lo que no toca y quedarse con 25 filas es lo que convertia el listado en una
   * pagina infinita que bloqueaba el navegador.
   */
  getParticipationsPage(query: ParticipationQuery = {}): ParticipationPage {
    const pageSize = Math.max(1, query.pageSize ?? DEFAULT_PARTICIPATION_PAGE_SIZE);
    // El texto se resuelve UNA vez y se comparte con el conteo y con la pagina.
    // Resolverlo en los dos seria recorrer el historial dos veces por pulsacion.
    const search = this.resolveSearch(query.search);
    const sort = query.sort ?? 'recent';

    if (sort === 'recent') {
      const total = this.countMatching(query, search);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
      const items = this.selectParticipations({ ...query, page, pageSize }, search);
      const from = total === 0 || items.length === 0 ? 0 : (page - 1) * pageSize + 1;

      return {
        items,
        total,
        page,
        pageSize,
        pageCount,
        from,
        to: items.length === 0 ? 0 : from + items.length - 1,
      };
    }

    // Para ordenar por una columna se ordena TODO lo filtrado y recien despues
    // se corta la pagina. Ordenar solo la pagina visible daria un resultado
    // incorrecto en las paginas siguientes.
    const all = this.selectParticipations(withoutPaging(query), search);
    const sorted = this.sortMatches(all, sort, query.sortDirection);
    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount,
      from: total === 0 || items.length === 0 ? 0 : start + 1,
      to: items.length === 0 ? 0 : start + items.length,
    };
  }

  /**
   * Cifras de las tarjetas de resumen sobre todo lo que cumple los filtros.
   *
   * Se cuentan en un solo recorrido: si cada tarjeta preguntara por su cuenta, los
   * numeros saldrian de la pagina visible y dejarian de describir el conjunto.
   */
  summarize(query: ParticipationQuery = {}): ParticipationSummary {
    // El resumen describe TODO lo que cumple los filtros, no la pagina visible.
    const matches = this.selectParticipations(
      withoutPaging(query),
      this.resolveSearch(query.search)
    );

    let valid = 0;
    let cancelled = 0;
    let pending = 0;
    let totalCredits = 0;
    let pendingGrades = 0;
    let withCertificate = 0;

    for (const participation of matches) {
      if (participation.status === 'VALID') {
        valid++;
        totalCredits += participation.credits;
        if (participation.grade === 'sin nota') {
          pendingGrades++;
        }
        if (primaryCertificateCode(participation) !== null) {
          withCertificate++;
        }
      } else if (participation.status === 'CANCELLED') {
        cancelled++;
      } else {
        pending++;
      }
    }

    return {
      total: matches.length,
      valid,
      cancelled,
      pending,
      totalCredits: Math.round(totalCredits * 100) / 100,
      pendingGrades,
      withCertificate,
    };
  }

  /**
   * Aplica filtros y, si se pide pagina, se detiene en cuanto tiene la ventana.
   *
   * `query.page` es la senal de "solo quiero esta pagina": al cortarse el
   * recorrido temprano, escribir en el buscador no arrastra ya el historial entero
   * detras. Sin pagina, se devuelve todo lo que cumple los filtros, que es lo que
   * necesitan las exportaciones y el resumen.
   */
  private selectParticipations(
    query: ParticipationQuery,
    search: ParticipationSearch
  ): Participation[] {
    const pageSize = query.pageSize ?? DEFAULT_PARTICIPATION_PAGE_SIZE;
    const bounded =
      query.page !== undefined || query.pageSize !== undefined
        ? { page: Math.max(1, query.page ?? 1), pageSize: Math.max(1, pageSize) }
        : undefined;

    const matches: Participation[] = [];
    let scanned = 0;

    for (const participation of this.iterateCandidates(query, search)) {
      if (!this.matchesFilters(participation, query, search)) {
        continue;
      }

      if (bounded) {
        if (scanned < (bounded.page - 1) * bounded.pageSize) {
          scanned++;
          continue;
        }
        if (matches.length >= bounded.pageSize) {
          break;
        }
      }

      matches.push(participation);
      scanned++;
    }

    return matches;
  }

  /**
   * De donde se lee el recorrido, segun lo que ya esta indexado.
   *
   * Elegir el indice mas estrecho disponible es lo que mantiene la consulta en
   * milisegundos: filtrar por evento lee solo las participaciones de ese evento,
   * y no las 1 200 000 del historial.
   */
  private *iterateCandidates(
    query: ParticipationQuery,
    search: ParticipationSearch
  ): Generator<Participation> {
    const eventBucket = query.eventId
      ? this.participationsByEvent().get(query.eventId)
      : undefined;

    if (eventBucket) {
      yield* eventBucket;
      return;
    }

    const studentBucket = query.studentId
      ? this.participationsByStudent().get(query.studentId)
      : undefined;

    if (studentBucket) {
      yield* studentBucket;
      return;
    }

    // Con busqueda ya se sabe cuales son las coincidencias y en que orden van.
    if (search.items) {
      yield* search.items;
      return;
    }

    yield* this.participationsByDate();
  }

  /**
   * Resuelve el texto buscado a un conjunto de ids, una sola vez por consulta.
   *
   * La busqueda cubre codigos, estudiantes y eventos. Los nombres se resuelven
   * primero a estudiantes y eventos, y de ahi se toman sus participaciones del
   * indice. Asi el nombre de una persona no obliga a recomponer el texto de un
   * millon de filas, y el filtro posterior es una consulta a un Set.
   * `items` es la lista de coincidencias ya ordenada por fecha, para que el
   * listado no vuelva a recorrer el historial entero solo para elegirla.
   */
  private resolveSearch(rawSearch: string | undefined): ParticipationSearch {
    const needle = (rawSearch ?? '').trim();
    if (!needle) {
      return { needle: '', ids: null, items: null };
    }

    const compactNeedle = compactCode(needle);
    const normalizedNeedle = normalizeForSearch(needle);

    // Nombres y eventos se resuelven a ids ANTES del recorrido. Preguntar despues
    // "que participaciones tiene este estudiante" obligaria a construir el indice
    // por estudiante, que sobre 1 200 000 filas cuesta mas que toda la busqueda.
    // Aqui basta con preguntar si el id de la fila esta en el conjunto.
    const studentIds = new Set(
      this.studentService.matchStudents(needle).map((student) => student.id)
    );

    const eventIds = new Set<number>();
    for (const event of this.eventService.events()) {
      if (matchesText(event.name, needle) || matchesText(event.code, needle)) {
        eventIds.add(event.id);
      }
    }

    const checkCodes = compactNeedle.length > 0;
    const matched: Participation[] = [];
    const ids = new Set<number>();

    const participations = this.participationsState();
    const codes = checkCodes ? this.compactCodeIndex() : null;

    // Un unico recorrido del historial.
    for (let index = 0; index < participations.length; index++) {
      const participation = participations[index];

      if (
        studentIds.has(participation.studentId) ||
        eventIds.has(participation.eventId) ||
        (codes !== null && codes[index].includes(compactNeedle))
      ) {
        matched.push(participation);
        ids.add(participation.id);
      }
    }

    // Solo se ordena lo que coincidio. Ordenar el historial entero para mostrar
    // cuatro resultados es lo que hacia lenta la primera busqueda.
    matched.sort((a, b) => b.participationDate.localeCompare(a.participationDate));

    return { needle, ids, items: matched };
  }

  /** Filtros sin texto, que ya son comparaciones directas de campo. */
  private matchesFilters(
    participation: Participation,
    query: ParticipationQuery,
    search: ParticipationSearch
  ): boolean {
    if (query.eventId && participation.eventId !== query.eventId) {
      return false;
    }
    if (query.studentId && participation.studentId !== query.studentId) {
      return false;
    }
    if (query.status && participation.status !== query.status) {
      return false;
    }
    if (search.ids && !search.ids.has(participation.id)) {
      return false;
    }

    return true;
  }

  /** Cuantas participaciones cumplen los filtros, sin armar la lista visible. */
  private countMatching(query: ParticipationQuery, search: ParticipationSearch): number {
    const eventBucket = query.eventId
      ? this.participationsByEvent().get(query.eventId)
      : undefined;
    if (eventBucket && !search.ids) {
      return eventBucket.length;
    }

    const studentBucket = query.studentId
      ? this.participationsByStudent().get(query.studentId)
      : undefined;
    if (studentBucket && !search.ids) {
      return studentBucket.length;
    }

    // Sin la pagina: contar lo que cabe en una ventana daria el tamano de la
    // ventana como total, y el total es lo que define cuantas paginas hay.
    return this.selectParticipations(withoutPaging(query), search).length;
  }

  /**
   * Orden distinto del natural.
   *
   * Solo se ordena lo que ya cumplio los filtros. En el peor caso son 1 200 000
   * filas, asi que se hace bajo demanda y no en cada pulsacion del buscador.
   */
  private sortMatches(
    matches: Participation[],
    sort: ParticipationSortKey,
    direction?: 'asc' | 'desc'
  ): Participation[] {
    const descending =
      direction !== undefined
        ? direction === 'desc'
        : sort === 'credits' || sort === 'recent';
    const sign = descending ? -1 : 1;
    const byDateDesc = (a: Participation, b: Participation): number =>
      b.participationDate.localeCompare(a.participationDate);

    switch (sort) {
      case 'date':
        return matches.sort(
          (a, b) =>
            sign * a.participationDate.localeCompare(b.participationDate) || byDateDesc(a, b)
        );
      case 'studentName':
        return matches.sort((a, b) => {
          const first = this.studentService.findById(a.studentId);
          const second = this.studentService.findById(b.studentId);
          const byName = NAME_COLLATOR.compare(
            `${first?.lastName ?? ''} ${first?.firstName ?? ''}`,
            `${second?.lastName ?? ''} ${second?.firstName ?? ''}`
          );
          return byName !== 0 ? sign * byName : byDateDesc(a, b);
        });
      case 'studentCode':
        return matches.sort((a, b) => {
          const byCode = collateCodes(
            this.studentService.findById(a.studentId)?.universityCode,
            this.studentService.findById(b.studentId)?.universityCode
          );
          return byCode !== 0 ? sign * byCode : byDateDesc(a, b);
        });
      case 'event':
        return matches.sort((a, b) => {
          const byName = NAME_COLLATOR.compare(
            this.eventService.findById(a.eventId)?.name ?? '',
            this.eventService.findById(b.eventId)?.name ?? ''
          );
          return byName !== 0 ? sign * byName : byDateDesc(a, b);
        });
      case 'credits':
        return matches.sort(
          (a, b) => sign * (a.credits - b.credits) || byDateDesc(a, b)
        );
      default:
        return matches;
    }
  }

  getByEvent(eventId: number): Participation[] {
    return this.getParticipations({ eventId });
  }

  getByStudent(studentId: number): Participation[] {
    return this.participationsByStudent().get(studentId) ?? [];
  }

  /**
   * Verificacion de pertenencia sin comparar contra toda la lista.
   * Con 260 000 estudiantes, preguntar "participa en algun evento?" con un
   * `some()` sobre el padron completo es inviable en cada fila de una tabla.
   */
  hasParticipations(studentId: number): boolean {
    const bucket = this.participationsByStudent().get(studentId);
    return Boolean(bucket && bucket.length > 0);
  }

  /** Participaciones del evento con evento y estudiante resueltos. */
  getEventTable(eventId: number): ParticipationContext[] {
    return this.getByEvent(eventId)
      .map((participation) => this.context(participation))
      .filter((item) => item.student !== undefined);
  }

  context(participation: Participation): ParticipationContext {
    return {
      participation,
      event: this.eventService.findById(participation.eventId),
      student:
        this.studentService.findById(participation.studentId) ??
        this.studentDirectory().get(participation.studentId),
    };
  }

  /** Busca solo por codigo DC. */
  findByVerificationCode(code: string): Participation | undefined {
    const needle = code.trim().toUpperCase();
    if (!needle) {
      return undefined;
    }
    return this.participationsState().find(
      (participation) => (participation.verificationCode ?? '').toUpperCase() === needle
    );
  }

  /**
   * Busca por CUALQUIER codigo del certificado: el vigente de DCredits o el
   * del sistema anterior.
   *
   * Es la busqueda que usa la pantalla de verificacion: un estudiante con un
   * certificado impreso en el sistema viejo debe poder encontrarlo con el
   * codigo que ya conoce. La comparacion ignora mayusculas, espacios y guiones,
   * porque al copiar un codigo antiguo es comun que se pegue con variantes; a
   * cambio nunca coincide por coincidir un fragmento suelto.
   */
  findByCertificateCode(code: string): Participation | undefined {
    return this.findAllByCertificateCode(code)[0];
  }

  /**
   * Todas las participaciones que comparten un codigo de certificado.
   *
   * Un codigo historico puede repetirse en eventos distintos; por eso la
   * verificacion ya no puede asumir un unico resultado.
   */
  findAllByCertificateCode(code: string): Participation[] {
    const needle = code.trim();
    if (!needle) {
      return [];
    }

    const upper = needle.toUpperCase();
    const exact = this.participationsState().filter(
      (participation) =>
        (participation.verificationCode ?? '').trim().toUpperCase() === upper ||
        (participation.legacyCode ?? '').trim().toUpperCase() === upper
    );

    // Primero se respeta el codigo tal cual. Solo si no hay coincidencia exacta
    // se aplica la comparacion tolerante (espacios/guiones), para no mezclar
    // dos documentos distintos que casualmente normalizan igual.
    if (exact.length > 0) {
      return exact;
    }

    return this.participationsState().filter(
      (participation) =>
        sameCertificateCode(participation.verificationCode, needle) ||
        sameCertificateCode(participation.legacyCode, needle)
    );
  }

  /** Participaciones cuyo codigo de certificado (DC o anterior) contiene el fragmento. */
  findByCodeFragment(fragment: string, limit = 5): Participation[] {
    if (fragment.trim().length < 3) {
      return [];
    }

    return this.participationsState()
      .filter(
        (participation) =>
          codeContains(participation.verificationCode, fragment) ||
          codeContains(participation.legacyCode, fragment)
      )
      .slice(0, limit);
  }

  exists(eventId: number, studentId: number): Participation | undefined {
    return this.participationsState().find(
      (participation) => participation.eventId === eventId && participation.studentId === studentId
    );
  }

  countForEvent(eventId: number, onlyValid = false): number {
    return this.participationsState().filter(
      (participation) =>
        participation.eventId === eventId && (!onlyValid || participation.status === 'VALID')
    ).length;
  }

  validate(
    draft: ParticipationDraft
  ): { valid: boolean; error?: ParticipationErrorCode; message?: string } {
    if (draft.credits < 0 || !Number.isFinite(draft.credits)) {
      return {
        valid: false,
        error: 'INVALID_CREDITS',
        message: 'Los créditos no pueden ser negativos.',
      };
    }

    const origin = draft.origin ?? 'CURRENT';
    const verificationCode = normalizeLegacyCode(draft.verificationCode);

    if (origin === 'LEGACY') {
      if (!verificationCode) {
        return {
          valid: false,
          error: 'INVALID_VERIFICATION_CODE',
          message: 'El registro histórico requiere el código de verificación original.',
        };
      }

      if (verificationCode.length > 60) {
        return {
          valid: false,
          error: 'INVALID_VERIFICATION_CODE',
          message: 'El código de verificación no puede superar 60 caracteres.',
        };
      }

      // El codigo historico puede repetirse: se conserva tal cual y la
      // identidad tecnica de la participacion es su id.
    } else if (verificationCode) {
      return {
        valid: false,
        error: 'INVALID_VERIFICATION_CODE',
        message: 'El código de verificación solo se usa en registros históricos.',
      };
    }

    const grade = (draft.grade ?? '').trim();

    if (grade && grade.toLowerCase() !== 'sin nota') {
      const numeric = Number(grade.replace(',', '.'));
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
        return {
          valid: false,
          error: 'INVALID_GRADE',
          message: 'La nota debe estar entre 0 y 20, o quedar vacía para "sin nota".',
        };
      }
    }

    return { valid: true };
  }

  async register(draft: ParticipationDraft): Promise<ParticipationResult> {
    const event = this.eventService.findById(draft.eventId);
    if (!event) {
      return {
        ok: false,
        error: 'EVENT_NOT_FOUND',
        message: 'El evento seleccionado no existe.',
      };
    }

    if (!acceptsParticipations(event)) {
      return {
        ok: false,
        error: 'EVENT_CANCELLED',
        message: 'No se pueden registrar participaciones en un evento cancelado.',
      };
    }

    if (!isRegistrationOpen(event)) {
      return {
        ok: false,
        error: 'EVENT_IMPORT_CLOSED',
        message:
          'El registro de este evento está cerrado. Habilita las cargas extemporáneas para registrar una lista posterior.',
      };
    }

    const student =
      this.studentService.findById(draft.studentId) ??
      this.studentDirectory().get(draft.studentId);
    if (!student) {
      return {
        ok: false,
        error: 'STUDENT_NOT_FOUND',
        message: 'Estudiante no encontrado en el padrón.',
      };
    }

    if (student.status !== 'ACTIVE') {
      return {
        ok: false,
        error: 'STUDENT_INACTIVE',
        message: 'El estudiante se encuentra inactivo en el padrón.',
      };
    }

    const existing = this.exists(draft.eventId, draft.studentId);
    if (existing) {
      return {
        ok: false,
        error: 'DUPLICATE',
        message: 'El estudiante ya está registrado en este evento.',
        existing,
      };
    }

    // Capacidad 0 o nula significa "sin limite".
    if (event.capacity !== null && event.capacity !== undefined && event.capacity > 0) {
      const registered = this.countForEvent(event.id, true);
      if (registered >= event.capacity) {
        return {
          ok: false,
          error: 'EVENT_FULL',
          message: 'El evento alcanzó su capacidad máxima.',
        };
      }
    }

    const check = this.validate(draft);
    if (!check.valid) {
      return { ok: false, error: check.error, message: check.message };
    }

    const legacyCode = normalizeLegacyCode(draft.legacyCode);
    const origin = draft.origin ?? 'CURRENT';
    const historicalCode = normalizeLegacyCode(draft.verificationCode);

    if (this.dataMode.isApi) {
      try {
        const created = await firstValueFrom(
          this.api.createParticipation(toApiParticipationPayload(draft))
        );
        const participation = mapApiParticipation(created);
        this.participationsState.update((current) => [participation, ...current]);
        return { ok: true, participation };
      } catch (error) {
        return this.apiErrorResult(error);
      }
    }

    const participation: Participation = {
      id: this.nextId(),
      eventId: draft.eventId,
      studentId: draft.studentId,
      participationDate: this.resolveParticipationDate(draft.eventId),
      credits: draft.credits,
      // En un registro historico se conserva el codigo original; en uno actual
      // lo genera el sistema.
      verificationCode:
        origin === 'LEGACY'
          ? historicalCode
          : generateVerificationCode(this.existingCodes()),
      legacyCode,
      grade: normalizeGrade(draft.grade),
      status: 'VALID',
      descriptionStatus: 'valid',
      origin,
      // Los registros que llegan por una recarga quedan marcados como
      // extemporaneos; el resto como carga regular.
      importMode:
        draft.importMode ?? (isLateImportsEnabled(event) ? 'LATE' : 'NORMAL'),
    };

    this.participationsState.update((current) => [participation, ...current]);
    return { ok: true, participation };
  }

  /** Traduce el error HTTP del alta al resultado que entiende la interfaz. */
  private apiErrorResult(error: unknown): ParticipationResult {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;

      if (error.status === 409) {
        return {
          ok: false,
          error: 'DUPLICATE',
          // El 409 puede ser por estudiante repetido o por codigo de
          // verificacion ya asignado: el mensaje del API es el mas preciso.
          message: detail ?? 'El estudiante ya está registrado en este evento.',
        };
      }
      if (error.status === 404) {
        return { ok: false, error: 'STUDENT_NOT_FOUND', message: detail ?? 'El evento o el estudiante no existe.' };
      }
      if (error.status === 400 || error.status === 422) {
        return { ok: false, error: 'EVENT_FULL', message: detail ?? 'No se pudo registrar la participación.' };
      }
      if (error.status === 403) {
        return {
          ok: false,
          error: 'EVENT_IMPORT_CLOSED',
          message: detail ?? 'No tienes permisos para registrar esta participación.',
        };
      }
      if (error.status >= 500) {
        return {
          ok: false,
          error: 'SERVER_ERROR',
          message:
            detail ??
            `El servicio de participaciones falló (HTTP ${error.status}). Revisa los logs del API.`,
        };
      }
    }
    return {
      ok: false,
      error: 'NETWORK_ERROR',
      message:
        'No se pudo conectar con el API de participaciones. Verifica que esté en ejecución y vuelve a intentarlo.',
    };
  }

  async update(id: number, edit: ParticipationEdit): Promise<Participation | null> {
    const current = this.participationsState().find((item) => item.id === id);
    if (!current) {
      return null;
    }

    const next: Participation = {
      ...current,
      credits: edit.credits ?? current.credits,
      grade: edit.grade !== undefined ? normalizeGrade(edit.grade) : current.grade,
      status: edit.status ?? current.status,
      descriptionStatus:
        edit.descriptionStatus !== undefined
          ? edit.descriptionStatus.trim()
          : current.descriptionStatus,
    };

    if (next.credits < 0) {
      return null;
    }

    if (next.grade !== 'sin nota') {
      const numeric = Number(next.grade.replace(',', '.'));
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
        return null;
      }
    }

    if (this.dataMode.isApi) {
      try {
        const updated = await firstValueFrom(
          this.api.updateParticipation(id, {
            credits: next.credits,
            grade: next.grade,
            status: next.status,
            ...(edit.descriptionStatus !== undefined
              ? { descriptionStatus: next.descriptionStatus }
              : {}),
          })
        );
        const participation = mapApiParticipation(updated);
        this.participationsState.update((items) =>
          items.map((item) => (item.id === id ? participation : item))
        );
        return participation;
      } catch {
        return null;
      }
    }

    this.participationsState.update((items) => items.map((item) => (item.id === id ? next : item)));
    return next;
  }

  /** Anula una participacion. Sus creditos dejan de sumar de inmediato. */
  async cancel(id: number, status: ParticipationStatus = 'CANCELLED'): Promise<Participation | null> {
    return this.update(id, { status });
  }

  /**
   * Elimina definitivamente una participacion (solo administradores).
   *
   * El backend vuelve a validar el rol. Es un borrado fisico: no se puede
   * recuperar la data.
   */
  async delete(id: number): Promise<ParticipationDeleteResult> {
    if (this.dataMode.isApi) {
      try {
        await firstValueFrom(this.api.deleteParticipation(id));
        this.participationsState.update((items) => items.filter((item) => item.id !== id));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: this.deleteErrorMessage(error) };
      }
    }

    this.participationsState.update((items) => items.filter((item) => item.id !== id));
    return { ok: true };
  }

  private deleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
      return detail ?? `No se pudo eliminar la participación (HTTP ${error.status}).`;
    }

    return 'No se pudo conectar con el API para eliminar la participación.';
  }

  /**
   * Estudiantes disponibles para registrar en un evento.
   *
   * Consulta el endpoint exclusivo del modulo de participaciones, que devuelve
   * estudiantes de TODAS las escuelas y excluye a los ya registrados.
   */
  /** Carga el directorio de estudiantes que usa el modulo de participaciones. */
  async loadStudentDirectory(): Promise<void> {
    if (!this.dataMode.isApi) {
      return;
    }

    try {
      const rows = await firstValueFrom(this.api.listParticipationStudents());
      this.studentDirectory.set(
        new Map(rows.map((row) => [row.id, mapApiEligibleStudent(row)])),
      );
    } catch {
      // Sin directorio se conserva el padron propio.
    }
  }

  /** Recuerda un estudiante para resolver su nombre sin recargar el directorio. */
  rememberStudent(student: Student): void {
    this.studentDirectory.update((current) => {
      const next = new Map(current);
      next.set(student.id, student);
      return next;
    });
  }

  async loadEligibleStudents(eventId: number): Promise<Student[]> {
    if (!this.dataMode.isApi) {
      return this.studentService.getStudents({ status: 'ACTIVE' });
    }

    try {
      const rows = await firstValueFrom(this.api.listEligibleStudents(eventId));
      const students = rows.map(mapApiEligibleStudent);

      // Se guardan tambien en el directorio para resolver nombre al registrar
      // y para la importacion por codigo.
      this.studentDirectory.update((current) => {
        const next = new Map(current);
        for (const student of students) {
          next.set(student.id, student);
        }
        return next;
      });

      return students;
    } catch {
      return [];
    }
  }

  /** Busca por codigo en el padron propio o en el directorio de participaciones. */
  private findStudentByCode(code: string): Student | undefined {
    const normalized = code.trim();
    return (
      this.studentService.findByUniversityCode(normalized) ??
      this.studentDirectoryByCode().get(normalized)
    );
  }

  /**
   * Etapa 1: Carga inicial de registros a estado temporal (en memoria)
   */
  importStage1(
    rows: (string | { code: string; grade?: string; verificationCode?: string })[],
  ): ParticipationImportStage1Result {
    const items: ParticipationImportStagedItem[] = [];
    let row = 0;
    for (const raw of rows) {
      row++;
      const code = (typeof raw === 'string' ? raw : raw.code)?.trim() ?? '';
      const grade = typeof raw === 'string' ? undefined : raw.grade;
      const verificationCode = typeof raw === 'string' ? undefined : raw.verificationCode;
      items.push({
        row,
        code,
        grade,
        verificationCode,
        valid: false,
      });
    }
    return {
      total: items.length,
      items,
    };
  }

  /**
   * Etapa 2: Validación contra base de datos antes de confirmar
   */
  importStage2(
    eventId: number,
    stagedItems: ParticipationImportStagedItem[],
    origin: ParticipationOrigin = 'CURRENT',
  ): ParticipationImportStage2Result {
    const event = this.eventService.findById(eventId);
    const errors: ParticipationImportError[] = [];
    const items: ParticipationImportStagedItem[] = stagedItems.map((item) => ({ ...item }));
    const isLegacy = origin === 'LEGACY';

    let validCount = 0;
    let invalidCount = 0;

    // Se resuelven una sola vez por evento: evita recorrer todo el historial
    // por cada fila de una carga de miles de lineas.
    const registeredIds = new Set(
      (this.participationsByEvent().get(eventId) ?? []).map(
        (participation) => participation.studentId,
      ),
    );
    const registeredCount =
      event && event.capacity !== null && event.capacity !== undefined && event.capacity > 0
        ? this.countForEvent(eventId, true)
        : 0;
    const validCodes = new Set<string>();

    for (const item of items) {
      const code = item.code;
      if (!code) {
        item.valid = false;
        item.error = 'Campo de código obligatorio no proporcionado';
        errors.push({ row: item.row, code: '[VACÍO]', reason: item.error });
        invalidCount++;
        continue;
      }

      if (validCodes.has(code)) {
        item.valid = false;
        item.error = 'Código duplicado en la carga';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      const historicalCode = normalizeLegacyCode(item.verificationCode);

      if (isLegacy) {
        if (!historicalCode) {
          item.valid = false;
          item.error = 'Falta el código de verificación original';
          errors.push({ row: item.row, code, reason: item.error });
          invalidCount++;
          continue;
        }

        if (historicalCode.length > 60) {
          item.valid = false;
          item.error = 'El código de verificación supera 60 caracteres';
          errors.push({ row: item.row, code, reason: item.error });
          invalidCount++;
          continue;
        }

        // En historicos el codigo puede repetirse, incluso dentro del archivo
        // o respecto de otra participacion del mismo evento.
        item.verificationCode = historicalCode;
      } else if (historicalCode) {
        item.valid = false;
        item.error = 'La carga actual no admite códigos de verificación';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      const student = this.findStudentByCode(code);
      if (!student) {
        item.valid = false;
        item.error = 'Código de estudiante no encontrado';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      if (registeredIds.has(student.id)) {
        item.valid = false;
        item.error = 'El estudiante ya está registrado en este evento';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      const grade = (item.grade ?? '').trim();
      if (grade && grade.toLowerCase() !== 'sin nota') {
        const numeric = Number(grade.replace(',', '.'));
        if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
          item.valid = false;
          item.error = 'La nota debe estar entre 0 y 20 o quedar vacía';
          errors.push({ row: item.row, code, reason: item.error });
          invalidCount++;
          continue;
        }
      }
      item.grade = grade || undefined;

      if (!event) {
        item.valid = false;
        item.error = 'Evento no válido';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      // La importacion masiva no depende del cierre de la primera carga.
      // Solo se bloquea un evento cancelado.
      if (!acceptsParticipations(event)) {
        item.valid = false;
        item.error = 'El evento no acepta más participaciones';
        errors.push({ row: item.row, code, reason: item.error });
        invalidCount++;
        continue;
      }

      if (event.capacity !== null && event.capacity !== undefined && event.capacity > 0) {
        if (registeredCount + validCount >= event.capacity) {
          item.valid = false;
          item.error = 'El evento alcanzó su capacidad máxima';
          errors.push({ row: item.row, code, reason: item.error });
          invalidCount++;
          continue;
        }
      }

      item.valid = true;
      item.studentId = student.id;
      item.student = student;
      validCodes.add(code);
      validCount++;
    }

    return {
      total: items.length,
      valid: validCount,
      invalid: invalidCount,
      items,
      errors,
    };
  }

  /**
   * Confirma el registro de los items validados en etapa 2.
   *
   * Ademas de registrar, sella un LOTE con la trazabilidad de la carga: modo
   * (regular o extemporanea), quien subio la lista, cuando y, en modo LATE,
   * quien autorizo la extemporaneidad y con que motivo. El lote queda asociado
   * al evento para poder mostrar despues "Carga extemporanea (subida
   * posterior)" con su lote, fecha y responsables.
   */
  async importStage2Commit(
    eventId: number,
    validItems: ParticipationImportStagedItem[],
    options: ParticipationImportCommitOptions = {}
  ): Promise<ParticipationImportSummary> {
    const mode: ParticipationImportMode = options.mode ?? 'NORMAL';
    const origin = options.origin ?? 'CURRENT';
    const uploadedBy = (options.uploadedBy ?? '').trim() || 'Coordinación DCredits';
    const total = validItems.length;

    if (this.dataMode.isApi) {
      const rows = validItems
        .filter((item) => item.valid)
        .map((item) => ({
          universityCode: item.code,
          ...(item.grade?.trim() ? { grade: item.grade.trim() } : {}),
          ...(origin === 'LEGACY' && item.verificationCode?.trim()
            ? { verificationCode: item.verificationCode.trim() }
            : {}),
        }));
      try {
        const result = await firstValueFrom(
          this.api.importParticipations(eventId, rows, origin)
        );
        await this.refreshFromApi();

        const errors: ParticipationImportError[] = [];
        const duplicates: string[] = [];
        const notFound: string[] = [];
        for (const issue of result.issues) {
          errors.push({ row: issue.row, code: issue.universityCode, reason: issue.message });
          if (issue.code === 'DUPLICATE_IN_FILE' || issue.code === 'ALREADY_REGISTERED') {
            duplicates.push(issue.universityCode);
          } else if (issue.code === 'STUDENT_NOT_FOUND') {
            notFound.push(issue.universityCode);
          }
        }

        const batchId = this.sealImportBatch(eventId, mode, uploadedBy, total, result.registered, result.skipped);
        return {
          total,
          found: result.found,
          notFound,
          duplicates,
          registered: result.registered,
          skipped: result.skipped,
          errors,
          batchId,
          mode,
          uploadedBy,
        };
      } catch {
        return this.importStage2CommitLocal(eventId, validItems, mode, uploadedBy, origin);
      }
    }

    return this.importStage2CommitLocal(eventId, validItems, mode, uploadedBy, origin);
  }

  /** Registro de la carga en memoria (modo local): valida y guarda item por item. */
  private async importStage2CommitLocal(
    eventId: number,
    validItems: ParticipationImportStagedItem[],
    mode: ParticipationImportMode,
    uploadedBy: string,
    origin: ParticipationOrigin = 'CURRENT'
  ): Promise<ParticipationImportSummary> {
    const errors: ParticipationImportError[] = [];
    let registered = 0;
    let skipped = 0;

    for (const item of validItems) {
      if (!item.valid || !item.studentId) {
        continue;
      }
      const result = await this.register({
        eventId,
        studentId: item.studentId,
        credits: this.eventService.findById(eventId)?.credits ?? 0,
        grade: item.grade,
        origin,
        verificationCode: origin === 'LEGACY' ? item.verificationCode : undefined,
      });

      if (result.ok) {
        registered++;
      } else {
        skipped++;
        errors.push({ row: item.row, code: item.code, reason: result.message ?? 'No se pudo registrar' });
      }
    }

    const batchId = this.sealImportBatch(eventId, mode, uploadedBy, validItems.length, registered, skipped);
    return {
      total: validItems.length,
      found: registered + skipped,
      notFound: [],
      duplicates: [],
      registered,
      skipped,
      errors,
      batchId,
      mode,
      uploadedBy,
    };
  }

  /**
   * Sella el LOTE de la carga con su trazabilidad y lo asocia al evento.
   *
   * El backend no expone lotes ni cierre por lote: esto es trazabilidad de la
   * interfaz (modo, quien subio, cuando), compartida por el modo real y el local.
   */
  private sealImportBatch(
    eventId: number,
    mode: ParticipationImportMode,
    uploadedBy: string,
    total: number,
    registered: number,
    skipped: number
  ): string {
    const batchId = `LOTE-${new Date().getFullYear()}-${String(++this.importBatchSequence).padStart(4, '0')}`;
    const event = this.eventService.findById(eventId);

    const batch: ParticipationImportBatch = {
      id: batchId,
      eventId,
      mode,
      createdAt: new Date().toISOString(),
      uploadedBy,
      total,
      registered,
      skipped,
      lateEnabledBy: mode === 'LATE' ? event?.lateImportsEnabledBy ?? null : null,
      lateEnabledAt: mode === 'LATE' ? event?.lateImportsEnabledAt ?? null : null,
      lateReason: mode === 'LATE' ? event?.lateImportsReason ?? null : null,
    };

    this.importBatchesState.update((current) => [batch, ...current]);
    this.eventService.recordImportBatch(eventId, { batchId, mode, uploadedBy });
    return batchId;
  }

  /** Recarga las participaciones del API tras una escritura en lote. */
  /**
   * Recarga el historial desde el API.
   *
   * Se usa, por ejemplo, despues de corregir la fecha de un evento: el backend
   * sincroniza las participaciones que habian heredado esa fecha.
   */
  async refresh(): Promise<void> {
    if (!this.dataMode.isApi) {
      return;
    }
    await this.refreshFromApi();
  }

  private async refreshFromApi(): Promise<void> {
    try {
      const participations = await firstValueFrom(this.api.listParticipations());
      this.participationsState.set(participations.map(mapApiParticipation));
    } catch {
      // Si falla la recarga se conserva el historial actual.
    }
  }

  /** Lotes de importacion de un evento, del mas reciente al mas antiguo. */
  importBatchesForEvent(eventId: number): ParticipationImportBatch[] {
    return this.importBatchesState().filter((batch) => batch.eventId === eventId);
  }

  /** Ultimo lote extemporaneo confirmado para un evento, si existe. */
  lastLateBatchForEvent(eventId: number): ParticipationImportBatch | undefined {
    return this.importBatchesState().find(
      (batch) => batch.eventId === eventId && batch.mode === 'LATE'
    );
  }

  /** Indica si el evento admite hoy un registro (abierto o extemporaneo). */
  canRegisterInEvent(eventId: number): boolean {
    const event = this.eventService.findById(eventId);
    return event ? isRegistrationOpen(event) : false;
  }

  /** Indica si el evento esta en modo LATE (cerrado con cargas habilitadas). */
  isLateMode(eventId: number): boolean {
    const event = this.eventService.findById(eventId);
    return event ? isLateImportsEnabled(event) : false;
  }

  /**
   * Importa participantes a un evento usando codigos universitarios.
   * No crea estudiantes: los que no existen en el padron se reportan como error.
   */
  importByUniversityCodes(eventId: number, codes: string[]): Promise<ParticipationImportSummary> {
    const stage1 = this.importStage1(codes);
    const stage2 = this.importStage2(eventId, stage1.items);
    return this.importStage2Commit(eventId, stage2.items.filter(i => i.valid));
  }

  /** Codigos DC ya emitidos. Las participaciones historicas sin codigo DC no cuentan. */
  /**
   * Codigos DC ya emitidos, como conjunto.
   *
   * Se reutiliza en toda la migracion: reconstruirlo cuesta un recorrido del
   * historial y un Set nuevo por cada codigo emitido.
   */
  private existingCodes(): ReadonlySet<string> {
    const codes = new Set<string>();
    for (const participation of this.participationsState()) {
      const code = participation.verificationCode;
      if (code) {
        codes.add(normalizeVerificationCode(code));
      }

      // El codigo del sistema anterior tambien es unico y no debe repetirse.
      const legacyCode = participation.legacyCode;
      if (legacyCode) {
        codes.add(normalizeVerificationCode(legacyCode));
      }
    }
    return codes;
  }

  /**
   * Un codigo de certificado identifica UNA participacion: no puede repetirse
   * ni entre codigos DC ni entre codigos del sistema anterior.
   */
  private resolveParticipationDate(eventId: number): string {
    const event = this.eventService.findById(eventId);
    // Fecha calendario, sin hora: evita que al formatearla en zona local se
    // muestre el dia anterior.
    return event?.startDate ?? new Date().toISOString().slice(0, 10);
  }

  private nextId(): number {
    const numbers = this.participationsState().map((participation) => participation.id);
    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  }
}

/** Normaliza la nota: vacia o "sin nota" se conserva como texto legible. */
function normalizeGrade(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  if (!text || text.toLowerCase() === 'sin nota') {
    return 'sin nota';
  }
  return text.replace(',', '.');
}

/** Resultado de eliminar una participacion. */
export interface ParticipationDeleteResult {
  ok: boolean;
  message?: string;
}
