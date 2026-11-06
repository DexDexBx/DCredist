import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
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
import { mapApiStudent, toApiStudentImportRows, toApiStudentPatch, toApiStudentPayload } from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { CatalogService } from './catalog.service';
import { DataModeService } from './data-mode.service';

/**
 * Fila de importacion del padron. Acepta CSV o pegado desde una hoja de calculo.
 *
 * La importacion referencia la escuela y la sede por NOMBRE: el archivo lo
 * prepara la institucion y el backend resuelve el nombre contra el catalogo.
 */
export interface StudentImportRow {
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchool: string;
  location: string;
}

export interface StudentImportSummary {
  total: number;
  created: number;
  updated: number;
  duplicates: string[];
  invalid: string[];
  /**
   * Motivo por el que la importacion no se aplico. El API es atomico: si una
   * fila falla, no se crea ninguna y aqui llega el detalle exacto.
   */
  message?: string;
  issues?: { row: number; universityCode: string; message: string }[];
}

/**
 * SERVICE - PADRON MAESTRO DE ESTUDIANTES.
 *
 * Lee del API (hidratado al arrancar) y escribe contra el backend cuando esta
 * disponible; sin API opera en memoria. Contrato:
 *   GET   /students?professionalSchoolId=&locationId=&status=&search=&page=&pageSize=&sort=
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
  private readonly catalogService = inject(CatalogService);
  private readonly studentsState = signal<Student[]>([]);

  readonly students = this.studentsState.asReadonly();

  /** Reemplaza el padron con el que devuelve el API (hidratacion al arrancar). */
  replaceAll(students: Student[]): void {
    this.studentsState.set(students.map((student) => this.withCatalogNames(student)));
  }

  /**
   * Resuelve escuela y sede contra el catalogo cargado usando sus ids.
   *
   * Es una red de seguridad: el API ya devuelve los nombres de las relaciones,
   * pero si una respuesta llega sin ellos (o con un dato viejo), la vista siempre
   * muestra el nombre vigente del catalogo.
   */
  private withCatalogNames(student: Student): Student {
    return {
      ...student,
      professionalSchool:
        this.catalogService.nameOf('professionalSchools', student.professionalSchoolId) ||
        student.professionalSchool,
      location:
        this.catalogService.nameOf('locations', student.locationId) || student.location,
    };
  }

  /**
   * Texto buscable de cada estudiante, ya normalizado y en el MISMO orden que
   * `studentsState`. Se recalcula una sola vez por cambio del padron.
   */
  private readonly searchIndex = computed(() =>
    this.studentsState().map((student) => studentSearchHaystack(student))
  );

  readonly totalCount = computed(() => this.studentsState().length);

  readonly activeCount = computed(
    () => this.studentsState().filter((student) => student.status === 'ACTIVE').length
  );

  /** Nombres de escuela presentes en el padron (para etiquetas y exportes). */
  readonly professionalSchools = computed<readonly string[]>(() => {
    const schools = new Set<string>();
    for (const student of this.studentsState()) {
      if (student.professionalSchool) {
        schools.add(student.professionalSchool);
      }
    }
    return schools.size > 0 ? [...schools].sort() : [];
  });

  /** Nombres de sede presentes en el padron. */
  readonly locations = computed<readonly string[]>(() => {
    const sites = new Set<string>();
    for (const student of this.studentsState()) {
      if (student.location) {
        sites.add(student.location);
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
   * Los tres ordenes se precomputan en vez de ordenarse en cada consulta:
   * escribir en el buscador no debe pagar un `sort` de 260 000 filas.
   */
  matchIndices(query: StudentQuery = {}, order?: readonly number[]): number[] {
    const tokens = searchTokens(query.search ?? '');
    const schoolId = query.professionalSchoolId ?? 0;
    const locationId = query.locationId ?? 0;
    const students = this.studentsState();
    const haystacks = this.searchIndex();

    const positions = order ?? this.orderFor(query.sort ?? 'name');
    const matches: number[] = [];

    for (const index of positions) {
      const student = students[index];

      if (schoolId && student.professionalSchoolId !== schoolId) {
        continue;
      }
      if (locationId && student.locationId !== locationId) {
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
   * Es la via que usan las busquedas de participacion y el modulo de codigos.
   */
  matchStudents(search: string): Student[] {
    const indices = this.matchIndices({ search });
    const students = this.studentsState();
    return indices.map((index) => students[index]);
  }

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

  private readonly nameOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'name')
  );

  private readonly codeOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'code')
  );

  private readonly recentOrder = computed(() =>
    this.sortIndices(this.allIndices(), this.studentsState(), 'recent')
  );

  private allIndices(): number[] {
    return this.studentsState().map((_, index) => index);
  }

  private sortIndices(indices: number[], students: Student[], key: StudentSortKey): number[] {
    switch (key) {
      case 'code':
        return indices.sort((a, b) =>
          CODE_COLLATOR.compare(students[a].universityCode, students[b].universityCode)
        );
      case 'recent':
        return indices.sort((a, b) => students[b].id - students[a].id);
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
  countBySchool(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const student of this.studentsState()) {
      counts.set(student.professionalSchoolId, (counts.get(student.professionalSchoolId) ?? 0) + 1);
    }
    return counts;
  }

  /** Estudiantes por sede, en una sola pasada. */
  countByLocation(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const student of this.studentsState()) {
      counts.set(student.locationId, (counts.get(student.locationId) ?? 0) + 1);
    }
    return counts;
  }

  /**
   * Indice por id. Con 260 000 estudiantes, buscar por id recorriendo el array
   * es latoso; el indice lo resuelve en tiempo constante.
   */
  private readonly byIdIndex = computed(() => {
    const index = new Map<number, Student>();
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

  private readonly lastSequence = computed(() => {
    let max = 0;

    for (const student of this.studentsState()) {
      if (student.id > max) {
        max = student.id;
      }
    }

    return max;
  });

  findById(id: number): Student | undefined {
    return this.byIdIndex().get(id);
  }

  findByUniversityCode(code: string): Student | undefined {
    return this.byUniversityCodeIndex().get(code.trim());
  }

  existsUniversityCode(code: string, exceptId?: number): boolean {
    const existing = this.findByUniversityCode(code);
    return Boolean(existing && existing.id !== exceptId);
  }

  validate(draft: StudentDraft, exceptId?: number): StudentValidation {
    const errors: StudentValidation['errors'] = {};

    if (!draft.universityCode.trim()) {
      errors.universityCode = 'El código universitario es obligatorio.';
    } else if (!/^\d{7}$/.test(draft.universityCode.trim())) {
      errors.universityCode = 'El código universitario debe tener exactamente 7 dígitos.';
    } else if (this.existsUniversityCode(draft.universityCode, exceptId)) {
      errors.universityCode = 'Ya existe un estudiante con este código universitario.';
    }

    if (!draft.lastName.trim()) {
      errors.lastName = 'Los apellidos son obligatorios.';
    } else if (draft.lastName.trim().length < 2) {
      errors.lastName = 'Los apellidos deben tener al menos 2 caracteres.';
    }

    if (!draft.firstName.trim()) {
      errors.firstName = 'Los nombres son obligatorios.';
    } else if (draft.firstName.trim().length < 2) {
      errors.firstName = 'Los nombres deben tener al menos 2 caracteres.';
    }

    if (!draft.professionalSchoolId) {
      errors.professionalSchoolId = 'La escuela profesional es obligatoria.';
    }

    if (!draft.locationId) {
      errors.locationId = 'La sede es obligatoria.';
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
        const student = this.withCatalogNames(mapApiStudent(created));
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

  /**
   * Elimina definitivamente un estudiante (solo administradores).
   *
   * El backend vuelve a validar el rol y bloquea el borrado si el estudiante
   * tiene cualquier participacion.
   */
  async delete(id: number): Promise<StudentDeleteResult> {
    if (this.dataMode.isApi) {
      try {
        await firstValueFrom(this.api.deleteStudent(id));
        this.studentsState.update((items) => items.filter((item) => item.id !== id));
        return { ok: true };
      } catch (error) {
        return { ok: false, message: this.deleteErrorMessage(error) };
      }
    }

    this.studentsState.update((items) => items.filter((item) => item.id !== id));
    return { ok: true };
  }

  private deleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: string | string[] } | null;
      const detail = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
      return detail ?? `No se pudo eliminar el estudiante (HTTP ${error.status}).`;
    }

    return 'No se pudo conectar con el API para eliminar el estudiante.';
  }

  async update(id: number, draft: StudentDraft): Promise<Student | null> {
    if (!this.findById(id) || !this.validate(draft, id).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      const current = this.findById(id) as Student;
      const patch = toApiStudentPatch(draft, current);

      // Sin cambios reales no se toca el API.
      if (Object.keys(patch).length === 0) {
        return current;
      }

      try {
        const updated = await firstValueFrom(this.api.updateStudent(id, patch));
        const student = this.withCatalogNames(mapApiStudent(updated));
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

  async setStatus(id: number, status: Student['status']): Promise<void> {
    const current = this.findById(id);
    if (!current) {
      return;
    }

    if (this.dataMode.isApi && current.status !== status) {
      try {
        const updated = await firstValueFrom(this.api.updateStudent(id, { status }));
        this.replaceById(id, this.withCatalogNames(mapApiStudent(updated)));
        return;
      } catch {
        // Si el API falla, no se toca el estado local.
        return;
      }
    }

    this.replaceById(id, { ...current, status });
  }

  /**
   * Normaliza como llega del formulario. Los nombres de escuela y sede se
   * resuelven contra el catalogo para no guardar etiquetas inventadas.
   */
  private normalizeDraft(draft: StudentDraft, id: number): Student {
    return {
      ...draft,
      id,
      universityCode: draft.universityCode.trim(),
      lastName: draft.lastName.trim().toUpperCase(),
      firstName: draft.firstName.trim().toUpperCase(),
      professionalSchool:
        draft.professionalSchool.trim() ||
        this.catalogService.nameOf('professionalSchools', draft.professionalSchoolId),
      location:
        draft.location.trim() || this.catalogService.nameOf('locations', draft.locationId),
    };
  }

  /** Reemplaza un estudiante por id sin recorrer el padron en la vista. */
  private replaceById(id: number, student: Student): void {
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
   *  - codigo existente    -> se conserva sin cambios,
   *  - fila incompleta     -> se reporta en `invalid`, no se crea.
   */
  async importStudents(rows: StudentImportRow[]): Promise<StudentImportSummary> {
    if (this.dataMode.isApi) {
      // Validacion local de estructura antes de viajar al API. Evita mensajes
      // viejos del backend y da feedback inmediato con las reglas actuales.
      const structureIssues = this.importStructureIssues(rows);

      if (structureIssues.length > 0) {
        return {
          total: rows.length,
          created: 0,
          updated: 0,
          duplicates: [],
          invalid: structureIssues.map((issue) => issue.universityCode).filter(Boolean),
          issues: structureIssues,
          message: `La importación no se aplicó: ${structureIssues.length} fila(s) con errores. No se creó ni modificó ningún estudiante.`,
        };
      }

      try {
        const result = await firstValueFrom(
          this.api.importStudents(toApiStudentImportRows(rows))
        );
        await this.refreshFromApi();
        return this.mapImportResult(result.total, result.created, result.enriched, result.issues);
      } catch (error) {
        // El API valida de forma atomica: un 400 significa que no se creo ni
        // modifico ningun estudiante. No se cae al modo local (eso simularia
        // una importacion que el backend rechazo).
        return this.failedImportSummary(rows.length, error);
      }
    }

    return this.importStudentsLocal(rows);
  }

  /** Resumen de una importacion rechazada, con los mensajes del API por fila. */
  private failedImportSummary(total: number, error: unknown): StudentImportSummary {
    const body =
      error instanceof HttpErrorResponse
        ? (error.error as { message?: unknown; issues?: unknown } | null)
        : null;

    const rawIssues = Array.isArray(body?.issues) ? body.issues : [];
    const issues = rawIssues
      .filter(
        (item): item is { row: number; universityCode: string; message: string } =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { message?: unknown }).message === 'string',
      )
      .map((item) => ({
        row: typeof item.row === 'number' ? item.row : 0,
        universityCode: typeof item.universityCode === 'string' ? item.universityCode : '',
        message: item.message,
      }));

    const message =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message
        : 'No se pudo completar la importación. No se creó ni modificó ningún estudiante.';

    return {
      total,
      created: 0,
      updated: 0,
      duplicates: [],
      invalid: issues.map((issue) => issue.universityCode).filter(Boolean),
      issues,
      message,
    };
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
      this.studentsState.set(students.map((student) => this.withCatalogNames(mapApiStudent(student))));
    } catch {
      // Si falla la recarga se conserva el padron actual.
    }
  }

  /** Errores de estructura de cada fila, sin consultar la base. */
  private importStructureIssues(
    rows: StudentImportRow[],
  ): { row: number; universityCode: string; message: string }[] {
    const issues: { row: number; universityCode: string; message: string }[] = [];

    rows.forEach((row, index) => {
      const universityCode = row.universityCode?.trim() ?? '';
      const lastName = row.lastName?.trim() ?? '';
      const firstName = row.firstName?.trim() ?? '';
      let message: string | null = null;

      if (!universityCode) {
        message = 'La fila no tiene código universitario.';
      } else if (!/^\d{7}$/.test(universityCode)) {
        message = 'El código universitario debe tener exactamente 7 dígitos.';
      } else if (!lastName || !firstName) {
        message = 'La fila debe traer apellidos y nombres.';
      } else if (lastName.length < 2 || firstName.length < 2) {
        message = 'Los apellidos y nombres deben tener al menos 2 caracteres cada uno.';
      } else if (!row.professionalSchool?.trim()) {
        message = 'La fila no trae escuela profesional.';
      } else if (!row.location?.trim()) {
        message = 'La fila no trae sede.';
      }

      if (message) {
        issues.push({ row: index + 1, universityCode, message });
      }
    });

    return issues;
  }

  private importStudentsLocal(rows: StudentImportRow[]): StudentImportSummary {
    const issues: { row: number; universityCode: string; message: string }[] = [];
    const seen = new Set<string>();
    const working = new Map<string, Student>(this.byUniversityCodeIndex());
    let nextSequence = this.lastSequence() + 1;

    /** Filas ya validadas: no se escriben hasta saber que todo el archivo pasa. */
    const resolved: {
      code: string;
      schoolId: number;
      locationId: number;
      lastName: string;
      firstName: string;
    }[] = [];

    rows.forEach((row, index) => {
      const universityCode = row.universityCode?.trim() ?? '';
      const schoolId = this.catalogIdByName('professionalSchools', row.professionalSchool);
      const locationId = this.catalogIdByName('locations', row.location);
      const issue = this.importRowIssue(row, universityCode, schoolId, locationId);

      if (issue) {
        issues.push({ row: index + 1, universityCode, message: issue });
        return;
      }

      if (seen.has(universityCode)) {
        issues.push({
          row: index + 1,
          universityCode,
          message: 'El código ya aparece en una fila anterior del archivo.',
        });
        return;
      }
      seen.add(universityCode);

      const existing = working.get(universityCode);

      if (existing && existing.professionalSchoolId !== schoolId) {
        issues.push({
          row: index + 1,
          universityCode,
          message:
            'El estudiante ya existe en otra escuela profesional; no se puede reasignar desde la importación.',
        });
        return;
      }

      if (existing && existing.locationId !== locationId) {
        issues.push({
          row: index + 1,
          universityCode,
          message:
            'El estudiante ya existe con otra sede; no se puede reasignar desde la importación.',
        });
        return;
      }

      resolved.push({
        code: universityCode,
        schoolId: schoolId as number,
        locationId: locationId as number,
        lastName: row.lastName,
        firstName: row.firstName,
      });
    });

    // Importacion atomica: una sola fila invalida impide escribir el archivo.
    if (issues.length > 0) {
      issues.sort((a, b) => a.row - b.row);

      return {
        total: rows.length,
        created: 0,
        updated: 0,
        duplicates: [],
        invalid: issues.map((issue) => issue.universityCode || '(sin código)'),
        issues,
        message: `La importación no se aplicó: ${issues.length} fila(s) con errores. No se creó ni modificó ningún estudiante.`,
      };
    }

    let created = 0;
    let updated = 0;

    for (const item of resolved) {
      const existing = working.get(item.code);

      if (!existing) {
        const student = this.normalizeDraft(
          {
            universityCode: item.code,
            lastName: item.lastName,
            firstName: item.firstName,
            professionalSchoolId: item.schoolId,
            professionalSchool: this.catalogService.nameOf('professionalSchools', item.schoolId),
            locationId: item.locationId,
            location: this.catalogService.nameOf('locations', item.locationId),
            status: 'ACTIVE',
          },
          nextSequence,
        );

        working.set(item.code, student);        nextSequence++;
        created++;
        continue;
      }

      // El estudiante ya existe: no se pisa ningun dato.
      updated++;
    }

    if (created > 0 || updated > 0) {
      this.studentsState.set(Array.from(working.values()));
    }

    return {
      total: rows.length,
      created,
      updated,
      duplicates: [],
      invalid: [],
    };
  }

  /** Id del catalogo a partir del nombre escrito en el archivo. */
  private catalogIdByName(kind: 'professionalSchools' | 'locations', name: string): number | null {
    const key = importKey(name);
    if (!key) {
      return null;
    }

    return (
      this.catalogService
        .options(kind)
        .find((option) => importKey(option.name) === key)?.id ?? null
    );
  }

  /**
   * Motivo por el que una fila del padron no puede cargarse.
   *
   * El codigo debe ser numerico (es la clave funcional del padron), los nombres
   * solo letras y escuela/sede deben existir en el catalogo.
   */
  private importRowIssue(
    row: StudentImportRow,
    universityCode: string,
    schoolId: number | null,
    locationId: number | null,
  ): string | null {
    if (!universityCode) {
      return 'La fila no tiene código universitario.';
    }

    if (!/^\d{7}$/.test(universityCode)) {
      return 'El código universitario debe tener exactamente 7 dígitos.';
    }

    if (
      !this.isPersonName(row.lastName) ||
      !this.isPersonName(row.firstName) ||
      (row.lastName?.trim().length ?? 0) < 2 ||
      (row.firstName?.trim().length ?? 0) < 2
    ) {
      return 'Los apellidos y nombres deben tener al menos 2 caracteres y solo letras, espacios, puntos, guiones o apóstrofes.';
    }

    if (!row.professionalSchool?.trim()) {
      return 'La fila no trae escuela profesional.';
    }

    if (!schoolId) {
      return `La escuela profesional "${row.professionalSchool}" no existe en el catálogo.`;
    }

    if (!row.location?.trim()) {
      return 'La fila no trae sede.';
    }

    if (!locationId) {
      return `La sede "${row.location}" no existe en el catálogo.`;
    }

    return null;
  }

  /** Un nombre propio: letras (con acentos), espacios, puntos, guiones o apostrofes. */
  private isPersonName(value: string | undefined): boolean {
    return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+[\s.'’-]*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.'’-]*$/.test(
      value?.trim() ?? ''
    );
  }

  private nextId(): number {
    return this.lastSequence() + 1;
  }
}

/** Normaliza nombres de catalogo: sin mayusculas, acentos ni espacios repetidos. */
function importKey(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Resultado de eliminar un estudiante. */
export interface StudentDeleteResult {
  ok: boolean;
  message?: string;
}
