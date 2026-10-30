import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_STUDENT_PAGE_SIZE,
  Student,
  StudentDraft,
  StudentPage,
  StudentQuery,
  StudentSortKey,
  StudentValidation,
  matchesStudentTokens,
  searchTokens,
  studentDisplayName,
  studentFullName,
  studentSearchHaystack,
} from '../../models';
import { CODE_COLLATOR, NAME_COLLATOR } from '../../shared/utils/text.utils';
import { mapApiStudent, toApiStudentImportRows, toApiStudentPayload } from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { DataModeService } from './data-mode.service';

/**
 /** Fila de importacion del padron. Acepta CSV o pegado desde una hoja de calculo. */
export interface StudentImportRow {
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  headquarters: string;
  academicDegree?: string;
}

export interface StudentImportSummary {
  total: number;
  created: number;
  updated: number;
  duplicates: string[];
  invalid: string[];
}

/**
 * SERVICE - PADRON MAESTRO DE ESTUDIANTES.
 *
 * Lee del API (hidratado al arrancar) y escribe contra el backend cuando esta
 * disponible; sin API opera en memoria como antes. Contrato:
 *   GET   /students?professionalSchool=&headquarters=&status=&search=&page=&pageSize=&sort=
 *   POST  /students
 *   PATCH /students/:id
 *   POST  /students/import   (carga incremental, nunca destructiva)
 *
 * VOLUMEN: el padron historico real tiene ~260 000 estudiantes. Por eso la vista
 * consume siempre `getStudentsPage()` (una pagina) y nunca la lista completa, y
 * por eso el texto buscable se normaliza UNA vez por estudiante (`searchIndex`)
 * en lugar de recomponerse en cada pulsacion.
 *
 * Regla de dominio: universityCode es UNIQUE. La validacion se hace aqui y
 * reaparece como constraint UNIQUE en el backend.
 */
@Injectable({ providedIn: 'root' })
export class StudentService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly studentsState = signal<Student[]>([]);

  readonly students = this.studentsState.asReadonly();

  /** Reemplaza el padron con el que devuelve el API (hidratacion al arrancar). */
  replaceAll(students: Student[]): void {
    this.studentsState.set(students);
  }

  /**
   * Texto buscable de cada estudiante, ya normalizado y en el MISMO orden que
   * `studentsState`. Se recalcula una sola vez por cambio del padron: filtrar
   * 260 000 estudiantes pasa de "5 concatenaciones por pulsacion" a "un
   * includes por pulsacion".
   */
  private readonly searchIndex = computed(() =>
    this.studentsState().map((student) => studentSearchHaystack(student))
  );

  readonly totalCount = computed(() => this.studentsState().length);

  readonly activeCount = computed(
    () => this.studentsState().filter((student) => student.status === 'ACTIVE').length
  );

  /**
   * Escuelas y sedes del padron vigente.
   *
   * Se derivan de los estudiantes cargados (del API o del estado local) para que los
   * filtros muestren lo que existe de verdad; si el padron esta vacio, se cae a
   * las listas base.
   */
  readonly professionalSchools = computed<readonly string[]>(() => {
    const schools = new Set<string>();
    for (const student of this.studentsState()) {
      if (student.professionalSchool) {
        schools.add(student.professionalSchool);
      }
    }
    return schools.size > 0 ? [...schools].sort() : [];
  });

  readonly headquarters = computed<readonly string[]>(() => {
    const sites = new Set<string>();
    for (const student of this.studentsState()) {
      if (student.headquarters) {
        sites.add(student.headquarters);
      }
    }
    return sites.size > 0 ? [...sites].sort() : [];
  });

  /**
   * Listado completo que cumple los filtros. Son ~260 000 objetos: solo para uso
   * interno y exportaciones, NUNCA para pintar una tabla.
   */
  getStudents(query: StudentQuery = {}): Student[] {
    return this.filter(query);
  }

  /** Pagina de estudiantes + totales reales. Es lo que consume la interfaz. */
  getStudentsPage(query: StudentQuery = {}): StudentPage {
    const students = this.studentsState();
    const matches = this.matchIndices(query);
    const pageSize = this.resolvePageSize(query.pageSize);
    const total = matches.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Math.trunc(query.page ?? 1)), pageCount);

    const offset = (page - 1) * pageSize;
    const items = matches.slice(offset, offset + pageSize).map((index) => students[index]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount,
      from: items.length === 0 ? 0 : offset + 1,
      to: offset + items.length,
    };
  }

  private filter(query: StudentQuery): Student[] {
    const students = this.studentsState();
    return this.matchIndices(query).map((index) => students[index]);
  }

  /**
   * Posiciones del padron que cumplen los filtros, ya ordenadas.
   *
   * Es la base de `getStudents()` y de las agregaciones de creditos: filtrar y
   * ordenar sobre indices evita crear 260 000 objetos intermedios para, alfinal,
   * mostrar 25.
   *
   * Los tres órdenes se precomputan en vez de ordenarse en cada consulta. Escribir
   * en el buscador no debe pagar un `sort` de 260 000 filas: los órdenes solo
   * cambian cuando cambia el padron, y filtrar sobre una lista ya ordenada es un
   * recorrido lineal.
   */
  matchIndices(query: StudentQuery = {}, order?: readonly number[]): number[] {
    // Los tokens se separan una vez por consulta. Normalizar el termino dentro
    // del recorrido seria hacerlo 260 000 veces por pulsacion.
    const tokens = searchTokens(query.search ?? '');
    const school = query.professionalSchool?.trim() ?? '';
    const site = query.headquarters?.trim() ?? '';
    const students = this.studentsState();
    const haystacks = this.searchIndex();

    // El orden por defecto es por apellidos: es como la institucion busca a una
    // persona. 'code' para buscar por codigo y 'recent' para el padron recien
    // cargado, que es lo que se mira al terminar una importacion.
    // Un llamador con su propio orden (por creditos) lo pasa y asi se ahorra
    // tambien el `sort` de 260 000 filas.
    const positions = order ?? this.orderFor(query.sort ?? 'name');
    const matches: number[] = [];

    for (const index of positions) {
      const student = students[index];

      if (school && student.professionalSchool !== school) {
        continue;
      }
      if (site && student.headquarters !== site) {
        continue;
      }
      if (query.status && student.status !== query.status) {
        continue;
      }
      if (tokens.length > 0 && !matchesStudentTokens(haystacks[index], tokens)) {
        continue;
      }

      matches.push(index);
    }

    return matches;
  }

  /**
   * Estudiantes que coinciden con un texto libre.
   *
   * Es lavia que usan las busquedas de participacion y el modulo de codigos:
   * en vez de recorrer participaciones recomponiendo el nombre de cada
   * estudiante, se resuelve primero a estudiantes y de ahi se toman sus
   * participaciones del indice.
   */
  matchStudents(search: string): Student[] {
    const indices = this.matchIndices({ search });
    const students = this.studentsState();
    return indices.map((index) => students[index]);
  }

  /**
   * Orden del padron para un criterio, ya calculado y cacheado.
   *
   * Vive en un `computed` justamente para que no se repita: ordenar 260 000 filas
   * por apellidos cuesta cientos de milisegundos, y eso solo hace falta cuando el
   * padron cambia, no cada vez que se escribe una letra en el buscador.
   */
  private orderFor(sort: StudentSortKey): readonly number[] {
    switch (sort) {
      case 'code':
        return this.codeOrder();
      case 'recent':
        return this.recentOrder();
      default:
        return this.nameOrder();
    }
  }

/**
   * ORDENES PRECOMPUTADOS DEL PADRON.
   *
   * Ordenar el padron completo es la parte mas cara de una consulta: con260 000
   * filas son cientos de milisegundos. Estos tres computed se recalculan solo
   * cuando el padron cambia (carga o importacion), no al escribir en el buscador.
   *
   * El orden por defecto es por apellidos, que es como la institucion busca a una
   * persona. 'code' para buscar por codigo y 'recent' para el padron recien
   * cargado, que es lo que se mira al terminar una importacion.
   */
  private readonly nameOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'name')
  );

  private readonly codeOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'code')
  );

  private readonly recentOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'recent')
  );

  /** Posiciones 0..n-1 del padron, en su orden natural. */
  private allIndices(): number[] {
    return this.studentsState().map((_, index) => index);
  }

  /** Aplica un criterio de orden a una lista de posiciones del padron. */
  private sortIndices(indices: number[], students: Student[], key: StudentSortKey): number[] {
    switch (key) {
      case 'code':
        return indices.sort((a, b) =>
          CODE_COLLATOR.compare(students[a].universityCode, students[b].universityCode)
        );
      case 'recent':
        return indices.sort((a, b) => students[b].id.localeCompare(students[a].id));
      default:
        return indices.sort(
          (a, b) =>
            NAME_COLLATOR.compare(students[a].lastName, students[b].lastName) ||
            NAME_COLLATOR.compare(students[a].firstName, students[b].firstName)
        );
    }
  }


  private resolvePageSize(pageSize: number | undefined): number {
    return pageSize && pageSize > 0 ? Math.trunc(pageSize) : DEFAULT_STUDENT_PAGE_SIZE;
  }

  /** Estudiantes por escuela profesional, en una sola pasada. */
  countBySchool(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const student of this.studentsState()) {
      counts.set(student.professionalSchool, (counts.get(student.professionalSchool) ?? 0) + 1);
    }
    return counts;
  }

  /** Estudiantes por sede, en una sola pasada. */
  countByHeadquarters(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const student of this.studentsState()) {
      counts.set(student.headquarters, (counts.get(student.headquarters) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Renombra una escuela profesional en el padron.
   *
   * Lo usa el catalogo de escuelas: al corregir el nombre, los estudiantes ya
   * registrados pasan a la escuela nueva. Devuelve cuantos cambiaron.
   */
  renameProfessionalSchool(previous: string, next: string): number {
    return this.renameField(previous, next, 'professionalSchool');
  }

  /** Renombra una sede en el padron. Devuelve cuantos estudiantes cambiaron. */
  renameHeadquarters(previous: string, next: string): number {
    return this.renameField(previous, next, 'headquarters');
  }

  private renameField(
    previous: string,
    next: string,
    field: 'professionalSchool' | 'headquarters',
  ): number {
    if (previous === next) {
      return 0;
    }

    let changed = 0;
    const updated = this.studentsState().map((student) => {
      if (student[field] !== previous) {
        return student;
      }
      changed++;
      return { ...student, [field]: next };
    });

    if (changed > 0) {
      this.studentsState.set(updated);
    }

    return changed;
  }

  /**
   * Indice por id. Con 260 000 estudiantes, buscar por id recorriendo el array
   * es latoso; el indice lo resuelve en tiempo constante.
   */
  private readonly byIdIndex = computed(() => {
    const index = new Map<string, Student>();
    for (const student of this.studentsState()) {
      index.set(student.id, student);
    }
    return index;
  });

  /** Indice por codigo universitario: la clave funcional y unica del padron. */
  private readonly byUniversityCodeIndex = computed(() => {
    const index = new Map<string, Student>();
    for (const student of this.studentsState()) {
      index.set(student.universityCode, student);
    }
    return index;
  });

  /**
   * Ultimo correlativo usado en los ids (`stu-NNNNNN`).
   *
   * Se toma del mayor id existente y no de la cantidad de estudiantes: el padron
   * puede traer huecos, y un id repetido hace que dos estudiantes distintos
   * compartan ficha. Es un `computed`, asi que recorrer el padron para calcularlo
   * pasa una sola vez por cambio, no en cada alta.
   */
  private readonly lastSequence = computed(() => {
    let max = 0;

    for (const student of this.studentsState()) {
      const sequence = Number(student.id.replace(/^stu-/, ''));
      if (Number.isFinite(sequence) && sequence > max) {
        max = sequence;
      }
    }

    return max;
  });

  findById(id: string): Student | undefined {
    return this.byIdIndex().get(id);
  }

  findByUniversityCode(code: string): Student | undefined {
    return this.byUniversityCodeIndex().get(code.trim());
  }

  existsUniversityCode(code: string, exceptId?: string): boolean {
    const existing = this.findByUniversityCode(code);
    return Boolean(existing && existing.id !== exceptId);
  }

  validate(draft: StudentDraft, exceptId?: string): StudentValidation {
    const errors: StudentValidation['errors'] = {};

    if (!draft.universityCode.trim()) {
      errors.universityCode = 'El código universitario es obligatorio.';
    } else if (this.existsUniversityCode(draft.universityCode, exceptId)) {
      errors.universityCode = 'Ya existe un estudiante con este código universitario.';
    }

    if (!draft.lastName.trim()) {
      errors.lastName = 'Los apellidos son obligatorios.';
    }

    if (!draft.firstName.trim()) {
      errors.firstName = 'Los nombres son obligatorios.';
    }

    if (!draft.professionalSchool.trim()) {
      errors.professionalSchool = 'La escuela profesional es obligatoria.';
    }

    if (!draft.headquarters.trim()) {
      errors.headquarters = 'La sede es obligatoria.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  async create(draft: StudentDraft): Promise<Student | null> {
    if (!this.validate(draft).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const created = await firstValueFrom(this.api.createStudent(toApiStudentPayload(draft)));
        const student = mapApiStudent(created);
        this.studentsState.update((current) => [...current, student]);
        return student;
      } catch {
        return null;
      }
    }

    return this.createLocal(draft);
  }

  private createLocal(draft: StudentDraft): Student {
    const student = this.normalizeDraft(draft, this.nextId());
    this.studentsState.update((current) => [...current, student]);
    return student;
  }

  async update(id: string, draft: StudentDraft): Promise<Student | null> {
    if (!this.findById(id) || !this.validate(draft, id).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const updated = await firstValueFrom(
          this.api.updateStudent(id, toApiStudentPayload(draft))
        );
        const student = mapApiStudent(updated);
        this.replaceById(id, student);
        return student;
      } catch {
        return null;
      }
    }

    const student = this.normalizeDraft(draft, id);
    this.replaceById(id, student);
    return student;
  }

  async setStatus(id: string, status: Student['status']): Promise<void> {
    const current = this.findById(id);
    if (!current) {
      return;
    }

    if (this.dataMode.isApi && current.status !== status) {
      try {
        const updated = await firstValueFrom(this.api.updateStudent(id, { status }));
        this.replaceById(id, mapApiStudent(updated));
        return;
      } catch {
        // Si el API falla, no se toca el estado local (evita mostrar un cambio que no persiste).
        return;
      }
    }

    this.replaceById(id, { ...current, status });
  }

  /**
   * Normaliza como llega del formulario o de una importacion: el padron guarda
   * texto en mayusculas y sin espacios sobrantes, para que "jose maria" y
   * "JOSE  MARIA " no creen dos registros distintos.
   */
  private normalizeDraft(draft: StudentDraft, id: string): Student {
    return {
      ...draft,
      id,
      universityCode: draft.universityCode.trim(),
      lastName: draft.lastName.trim().toUpperCase(),
      firstName: draft.firstName.trim().toUpperCase(),
      professionalSchool: draft.professionalSchool.trim().toUpperCase(),
      headquarters: draft.headquarters.trim().toUpperCase(),
      academicDegree: draft.academicDegree.trim(),
    };
  }

  /** Reemplaza un estudiante por id sin recorrer el padron en la vista. */
  private replaceById(id: string, student: Student): void {
    this.studentsState.update((current) => {
      const next = current.slice();
      const index = next.findIndex((item) => item.id === id);
      if (index >= 0) {
        next[index] = student;
      }
      return next;
    });
  }

  fullName(student: Student): string {
    return studentFullName(student);
  }

  displayName(student: Student): string {
    return studentDisplayName(student);
  }

  /**
   * Importacion INCREMENTAL del padron.
   *
   * Nunca es destructiva ni reemplaza el padron completo:
   *  - codigo nuevo        -> se crea,
   *  - codigo existente    -> se completa/enriquece solo los campos vacios,
   *  - fila incompleta     -> se reporta en `invalid`, no se crea.
   *
   * Si la institucion envia repetidamente el mismo archivo, el resultado es
   * idempotente. Esto es lo que exige un maestro real.
   *
   * El padron se escribe UNA sola vez al final: con 260 000 estudiantes, actualizar
   * el estado fila por fila seria copiar el array entero por cada fila.
   */
  async importStudents(rows: StudentImportRow[]): Promise<StudentImportSummary> {
    if (this.dataMode.isApi) {
      try {
        const result = await firstValueFrom(
          this.api.importStudents(toApiStudentImportRows(rows))
        );
        await this.refreshFromApi();
        return this.mapImportResult(result.total, result.created, result.enriched, result.issues);
      } catch {
        return this.importStudentsLocal(rows);
      }
    }

    return this.importStudentsLocal(rows);
  }

  /** Traduce el resultado del API (issues tipados) al resumen que usa la vista. */
  private mapImportResult(
    total: number,
    created: number,
    enriched: number,
    issues: { universityCode: string; code: string }[]
  ): StudentImportSummary {
    const duplicates: string[] = [];
    const invalid: string[] = [];
    for (const issue of issues) {
      if (issue.code === 'DUPLICATE_IN_FILE') {
        duplicates.push(issue.universityCode);
      } else {
        invalid.push(issue.universityCode);
      }
    }
    return { total, created, updated: enriched, duplicates, invalid };
  }

  private async refreshFromApi(): Promise<void> {
    try {
      const students = await firstValueFrom(this.api.listStudents());
      this.studentsState.set(students.map(mapApiStudent));
    } catch {
      // Si falla la recarga se conserva el padron actual.
    }
  }

  private importStudentsLocal(rows: StudentImportRow[]): StudentImportSummary {
    const duplicates: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    // Copia de trabajo indexada: crear y enriquecer sin tocar el signal.
    const working = new Map<string, Student>(this.byUniversityCodeIndex());
    let nextSequence = this.lastSequence() + 1;
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const universityCode = row.universityCode?.trim() ?? '';

      if (this.importRowIssue(row, universityCode)) {
        invalid.push(universityCode || '(sin código)');
        continue;
      }

      if (seen.has(universityCode)) {
        duplicates.push(universityCode);
        continue;
      }
      seen.add(universityCode);

      const existing = working.get(universityCode);

      if (!existing) {
        const student: Student = this.normalizeDraft({
          universityCode,
          academicDegree: row.academicDegree?.trim() ?? '',
          lastName: row.lastName,
          firstName: row.firstName,
          professionalSchool: row.professionalSchool,
          headquarters: row.headquarters,
          status: 'ACTIVE',
        }, `stu-${String(nextSequence).padStart(6, '0')}`);

        working.set(universityCode, student);
        nextSequence++;
        created++;
        continue;
      }

      working.set(universityCode, {
        ...existing,
        academicDegree: existing.academicDegree || row.academicDegree?.trim() || '',
        professionalSchool: existing.professionalSchool || row.professionalSchool,
        headquarters: existing.headquarters || row.headquarters,
      });
      updated++;
    }

    if (created > 0 || updated > 0) {
      const next = Array.from(working.values());
      this.studentsState.set(next);
    }

    return {
      total: rows.length,
      created,
      updated,
      duplicates,
      invalid,
    };
  }

  /**
   * Motivo por el que una fila del padron no puede cargarse.
   *
   * El codigo debe ser numerico (es la clave funcional del padron), los nombres
   * solo letras y escuela/sede son obligatorios: una fila que no cumpla esto
   * crearia un estudiante erroneo.
   */
  private importRowIssue(row: StudentImportRow, universityCode: string): string | null {
    if (!universityCode) {
      return 'MISSING_CODE';
    }

    if (!/^\d{4,15}$/.test(universityCode)) {
      return 'INVALID_CODE';
    }

    if (!this.isPersonName(row.lastName) || !this.isPersonName(row.firstName)) {
      return 'INVALID_NAME';
    }

    if (!row.professionalSchool?.trim()) {
      return 'MISSING_SCHOOL';
    }

    if (!row.headquarters?.trim()) {
      return 'MISSING_HEADQUARTERS';
    }

    return null;
  }

  /** Un nombre propio: letras (con acentos), espacios, puntos, guiones o apostrofes. */
  private isPersonName(value: string | undefined): boolean {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+[\s.'’-]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'’-]*$/.test(
      value?.trim() ?? ''
    );
  }

  /**
   * Siguiente id libre del padron.
   *
   * Se toma del ultimo `stu-NNNNNN`, no de la cantidad de estudiantes: el padron
   * puede traer huecos y, con el codigo como clave funcional, un id repetido
   * hace que dos estudiantes distintos compartan ficha.
   */
  private nextId(): string {
    return `stu-${String(this.lastSequence() + 1).padStart(6, '0')}`;
  }
}
