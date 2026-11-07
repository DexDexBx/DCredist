import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EventService } from '../../../../core/services/event.service';
import { ParticipationLoadRequestService } from '../../../../core/services/participation-load-request.service';
import {
  ParticipationImportError,
  ParticipationImportStage1Result,
  ParticipationImportStage2Result,
  ParticipationImportSummary,
  ParticipationService,
} from '../../../../core/services/participation.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  EVENT_LOAD_STATE_LABEL,
  EventLoadState,
  IMPORT_MODE_LABEL,
  LOAD_REQUEST_STATUS_LABEL,
  LoadRequestStatus,
  ParticipationImportBatch,
  ParticipationImportMode,
  PARTICIPATION_ORIGIN_LABEL,
  ParticipationLoadRequest,
  ParticipationOrigin,
  Student,
  acceptsParticipations,
  eventLoadState,
  isImportCompleted,
  isLateImportsEnabled,
  isRegistrationOpen,
} from '../../../../models';
import { formatMediumDate, formatTime } from '../../../../shared/utils/date.utils';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { DcComboboxComponent } from '../../../../shared/components/form/dc-combobox/dc-combobox.component';
import { DcSelectOption } from '../../../../shared/components/form/dc-select/dc-select.component';
import { BadgeComponent, BadgeColor } from '../../../../shared/components/ui/badge/badge.component';
import { DcCodeComponent } from '../../../../shared/components/ui/dc-code/dc-code.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { parseDelimitedText } from '../../../../shared/utils/csv.utils';
import {
  IMPORT_FILE_ACCEPT,
  isImportFileSupported,
  readImportFileText,
} from '../../../../shared/utils/import-file.utils';
import { downloadXlsx } from '../../../../shared/utils/xlsx.utils';

/** Paso del asistente de importacion. */
type ImportStep = 1 | 2 | 3;

/**
 * REGISTRO DE PARTICIPANTES.
 *
 *  - Manual: un estudiante por vez.
 *  - Importacion: asistente en un modal que carga codigos universitarios,
 *    valida y confirma el registro en tres pasos.
 *
 * En ambos casos el estudiante DEBE existir en el padron: registrar una
 * participacion nunca crea un estudiante nuevo.
 */
@Component({
  selector: 'dc-participation-register',
  imports: [
    BadgeComponent,
    DcCodeComponent,
    DcComboboxComponent,
    DcInputComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    PanelComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './participation-register.component.html',
})
export class ParticipationRegisterComponent {
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);
  private readonly loadRequestService = inject(ParticipationLoadRequestService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  /** Evento preseleccionado desde el detalle del evento (/participations/register?evento=id). */
  private readonly initialEventId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('evento') ?? '')),
    { initialValue: '' }
  );

  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly createdCode = signal<string | null>(null);

  // --- Tipo de registro: actual (codigo generado) o historico (codigo propio) ---
  readonly originModalOpen = signal(false);
  readonly registerOrigin = signal<ParticipationOrigin>('CURRENT');
  readonly originLabel = PARTICIPATION_ORIGIN_LABEL;
  readonly isLegacy = computed(() => this.registerOrigin() === 'LEGACY');

  // --- Asistente de importacion (modal) ---
  readonly importOpen = signal(false);
  readonly importStep = signal<ImportStep>(1);
  readonly importText = signal('');
  readonly importFileName = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importStage1 = signal<ParticipationImportStage1Result | null>(null);
  readonly importStage2 = signal<ParticipationImportStage2Result | null>(null);
  readonly importErrors = signal<ParticipationImportError[]>([]);
  readonly importSummary = signal<ParticipationImportSummary | null>(null);

  /**
   * Filas dibujadas como maximo en el modal de importacion.
   *
   * Una carga de miles de codigos no puede pintar miles de filas de tabla: el
   * navegador se congela. Los totales y el reporte descargable siguen completos.
   */
  readonly importPreviewLimit = 200;
  readonly stage2PreviewItems = computed(() =>
    (this.importStage2()?.items ?? []).slice(0, this.importPreviewLimit)
  );
  readonly importErrorsPreview = computed(() =>
    this.importErrors().slice(0, this.importPreviewLimit)
  );

  // --- Modo de la carga y trazabilidad de extemporaneos ---
  readonly importMode = signal<ParticipationImportMode>('NORMAL');
  readonly lateUploadedBy = signal('');

  /** Tipo de registro de la carga masiva: actual o historico. */
  readonly importOrigin = signal<ParticipationOrigin>('CURRENT');
  readonly isLegacyImport = computed(() => this.importOrigin() === 'LEGACY');

  readonly importModeLabel = IMPORT_MODE_LABEL;

  /** Formatos que aceptan los inputs de archivo de las importaciones. */
  readonly fileAccept = IMPORT_FILE_ACCEPT;

  // --- Solicitudes de carga (recargas) ---
  readonly requestOpen = signal(false);
  readonly requestError = signal<string | null>(null);
  readonly requestText = signal('');
  readonly requestFileName = signal<string | null>(null);
  readonly isRequestDragging = signal(false);
  readonly resolveOpen = signal(false);
  readonly resolveError = signal<string | null>(null);
  readonly resolvingRequest = signal<ParticipationLoadRequest | null>(null);

  /** Formulario que registra una solicitud recibida por un canal externo. */
  readonly requestForm = this.fb.nonNullable.group({
    requestedBy: ['', [Validators.required]],
    reason: ['', [Validators.required]],
  });

  /** Formulario que resuelve una solicitud: aprobarla o rechazarla. */
  readonly resolveForm = this.fb.nonNullable.group({
    decision: ['APPROVED' as 'APPROVED' | 'REJECTED', [Validators.required]],
    resolvedBy: ['', [Validators.required]],
    note: [''],
  });

  /**
   * Control propio de los modales. El contenido proyectado de un modal se crea
   * al inicio (con el evento vacío) y no recibe el `emitModelToViewChange: false`
   * de la selección en la vista, por eso necesita su propio control sincronizado.
   */
  private readonly modalEventId = this.fb.nonNullable.control('');

  readonly importSteps = [
    { id: 1 as ImportStep, label: 'Cargar' },
    { id: 2 as ImportStep, label: 'Validar' },
    { id: 3 as ImportStep, label: 'Resultado' },
  ];

  readonly eventSearch = signal('');
  readonly events = this.eventService.events;
  readonly openEvents = computed(() =>
    this.events().filter((event) => acceptsParticipations(event))
  );

  readonly studentSearchCode = signal('');
  readonly foundStudent = signal<any | null>(null);
  readonly studentSearchError = signal<string | null>(null);

  /** Estudiantes de todas las escuelas que aun pueden entrar al evento. */
  readonly eligibleStudents = signal<Student[]>([]);
  readonly loadingEligible = signal(false);

  readonly form = this.fb.nonNullable.group({
    eventId: ['', [Validators.required]],
    studentId: ['', [Validators.required]],
    grade: [''],
    /** Solo se exige en un registro historico. */
    verificationCode: [''],
  });

  private readonly eventIdSignal = toSignal(
    this.form.controls.eventId.valueChanges,
    { initialValue: this.form.controls.eventId.value }
  );

  /** Id numerico del evento; 0 mientras no se elige. */
  readonly selectedEventId = computed(() => {
    const value = this.eventIdSignal();
    return value ? Number(value) : 0;
  });

  readonly selectedEvent = computed(() =>
    this.events().find((event) => event.id === this.selectedEventId())
  );

  /** La lista ya fue cerrada (existe `importCompletedAt`). */
  readonly importCompleted = computed(() => {
    const event = this.selectedEvent();
    return event ? isImportCompleted(event) : false;
  });

  /** El evento esta cerrado, pero se reabrieron las cargas extemporaneas. */
  readonly lateEnabled = computed(() => {
    const event = this.selectedEvent();
    return event ? isLateImportsEnabled(event) : false;
  });

  /** El evento admite registrar AHORA (abierto, o cerrado con cargas LATE). */
  readonly registrationOpen = computed(() => {
    const event = this.selectedEvent();
    return event ? isRegistrationOpen(event) : false;
  });

  /** Lotes confirmados del evento seleccionado, del mas reciente al mas antiguo. */
  readonly eventBatches = computed<ParticipationImportBatch[]>(() => {
    const eventId = this.selectedEventId();
    return eventId ? this.participationService.importBatchesForEvent(eventId) : [];
  });

  /** Ultimo lote extemporaneo del evento: es el que respalda el modo LATE. */
  readonly lastLateBatch = computed<ParticipationImportBatch | null>(() => {
    const eventId = this.selectedEventId();
    return eventId ? this.participationService.lastLateBatchForEvent(eventId) ?? null : null;
  });

  readonly loadStateLabel = EVENT_LOAD_STATE_LABEL;
  readonly requestStatusLabel = LOAD_REQUEST_STATUS_LABEL;

  /** Estado de la carga, calculado por el sistema (no lo marca el usuario). */
  readonly loadState = computed<EventLoadState>(() => {
    const event = this.selectedEvent();
    return event ? eventLoadState(event) : 'SIN_PRIMERA_CARGA';
  });

  /** Solicitudes de recarga del evento, de la mas reciente a la mas antigua. */
  readonly loadRequests = computed<ParticipationLoadRequest[]>(() => {
    const eventId = this.selectedEventId();
    return eventId ? this.loadRequestService.requestsForEvent(eventId) : [];
  });

  /** Solicitud pendiente de resolver, si existe. */
  readonly pendingRequest = computed<ParticipationLoadRequest | null>(() => {
    const eventId = this.selectedEventId();
    return eventId ? this.loadRequestService.pendingForEvent(eventId) ?? null : null;
  });

  readonly registeredCount = computed(() =>
    this.selectedEventId() ? this.participationService.countForEvent(this.selectedEventId(), true) : 0
  );

  readonly eventOptions = computed<DcSelectOption[]>(() =>
    [...this.openEvents()]
      // Orden natural del catalogo: 1, 2, 3... sin depender del orden del API.
      .sort((a, b) => a.id - b.id)
      .map((event) => ({
        value: String(event.id),
        label: `${event.code} · ${event.name}`,
        description: [event.organizer, `${event.credits} crd.`]
          .filter((part): part is string => Boolean(part))
          .join(' · '),
        search: `${event.code} ${event.name} ${event.organizer ?? ''} ${event.modality}`,
      }))
  );

  /**
   * Estudiantes ofrecidos al registrar: activos, de la escuela del evento y
   * que todavia no tengan una participacion en ese evento. Asi el selector no
   * vuelve a ofrecer a quien ya fue registrado.
   */
  readonly studentOptions = computed<DcSelectOption[]>(() => {
    const event = this.selectedEvent();
    if (!event) {
      return [];
    }

    const registered = new Set(
      this.participationService
        .getByEvent(event.id)
        .map((participation) => participation.studentId),
    );

    return this.eligibleStudents()
      .filter((student) => !registered.has(student.id))
      .map((student) => ({
        value: String(student.id),
        // La escuela va en el texto principal para que tambien se vea al
        // seleccionar al estudiante, no solo en el desplegable.
        label: `${student.universityCode} · ${student.lastName}, ${student.firstName}${
          student.professionalSchool ? ` · ${student.professionalSchool}` : ''
        }`,
        search: `${student.universityCode} ${student.lastName} ${student.firstName} ${student.professionalSchool} ${student.location}`,
        description: student.location,
      }));
  });

  /** Ejemplo de contenido segun el tipo de carga. */
  readonly importPlaceholder = computed(() =>
    this.isLegacyImport()
      ? '2213271;SIS/2019/008821;16\n2213065;SIS/2019/008822;17'
      : '2213271\n2213065\n2213099'
  );

  /** Codigos detectados en el texto/archivo cargado (vista previa en vivo). */
  readonly importPreviewCount = computed(() => {
    const text = this.importText().trim();
    if (!text) return 0;
    return parseDelimitedText(text, 1).filter((row) => (row[0] ?? '').trim().length > 0).length;
  });

  /** Codigos de la carga adjunta a una solicitud (vista previa en vivo). */
  readonly requestPreviewCount = computed(() => {
    const text = this.requestText().trim();
    if (!text) return 0;
    return parseDelimitedText(text, 1).filter((row) => (row[0] ?? '').trim().length > 0).length;
  });

  constructor() {
    this.applyOriginValidators(this.registerOrigin());

    const initial = this.initialEventId();
    if (initial) {
      this.form.patchValue({ eventId: initial });
      this.modalEventId.setValue(initial);
    }

    // Sincroniza el evento de los modales con el formulario principal.
    this.modalEventId.valueChanges.subscribe((value) => {
      if (value !== this.form.controls.eventId.value) {
        this.form.controls.eventId.setValue(value);
      }
    });

    // Al cambiar de evento se cargan los estudiantes de todas las escuelas.
    effect(() => {
      const eventId = this.selectedEventId();
      this.form.controls.studentId.setValue('');
      this.foundStudent.set(null);
      this.studentSearchCode.set('');
      this.studentSearchError.set(null);
      this.eligibleStudents.set([]);

      if (!eventId) {
        this.loadingEligible.set(false);
        return;
      }

      this.loadingEligible.set(true);
      void this.loadEligibleFor(eventId);
    });
  }

  private async loadEligibleFor(eventId: number): Promise<void> {
    const students = await this.participationService.loadEligibleStudents(eventId);
    // Si el evento cambio mientras respondia el API, se descarta la respuesta.
    if (this.selectedEventId() !== eventId) {
      return;
    }
    this.eligibleStudents.set(students);
    this.loadingEligible.set(false);
  }

  // --- Tipo de registro ---

  openOriginModal(): void {
    this.originModalOpen.set(true);
  }

  closeOriginModal(): void {
    this.originModalOpen.set(false);
  }

  selectOrigin(origin: ParticipationOrigin): void {
    this.registerOrigin.set(origin);
    this.applyOriginValidators(origin);
    this.originModalOpen.set(false);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (origin === 'CURRENT') {
      this.form.controls.verificationCode.setValue('');
    }
  }

  /**
   * El codigo original solo es obligatorio en registros historicos. Se
   * reconfiguran los validadores al cambiar de tipo para que el formulario
   * marque el campo correctamente.
   */
  private applyOriginValidators(origin: ParticipationOrigin): void {
    const control = this.form.controls.verificationCode;
    control.setValidators(
      origin === 'LEGACY'
        ? [Validators.required, Validators.maxLength(60)]
        : [Validators.maxLength(60)]
    );
    control.updateValueAndValidity();
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.createdCode.set(null);

    const event = this.selectedEvent();
    if (!event) {
      this.errorMessage.set('Selecciona el evento del registro.');
      return;
    }

    const value = this.form.getRawValue();
    const origin = this.registerOrigin();
    const historicalCode = value.verificationCode.trim();

    if (origin === 'LEGACY') {
      if (!historicalCode) {
        this.form.controls.verificationCode.markAsTouched();
        this.errorMessage.set('Ingresa el código de verificación original del registro histórico.');
        return;
      }

      if (historicalCode.length > 60) {
        this.form.controls.verificationCode.markAsTouched();
        this.errorMessage.set('El código de verificación no puede superar 60 caracteres.');
        return;
      }

      if (this.participationService.isVerificationCodeTaken(historicalCode)) {
        this.errorMessage.set('Ese código de verificación ya está asignado a otra participación.');
        return;
      }
    }

    const studentId = Number(value.studentId);
    const selectedStudent =
      this.studentService.findById(studentId) ??
      this.eligibleStudents().find((item) => item.id === studentId);
    if (selectedStudent) {
      this.participationService.rememberStudent(selectedStudent);
    }

    const result = await this.participationService.register({
      eventId: event.id,
      studentId,
      // Los creditos SIEMPRE vienen del evento: no se editan aqui.
      credits: event.credits,
      grade: value.grade.trim() || undefined,
      origin,
      // En un registro actual el codigo lo genera el servidor.
      ...(origin === 'LEGACY' ? { verificationCode: historicalCode } : {}),
    });

    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'No fue posible registrar la participación.');
      return;
    }

    const student =
      this.studentService.findById(studentId) ??
      this.eligibleStudents().find((item) => item.id === studentId);
    if (student) {
      this.participationService.rememberStudent(student);
    }

    this.createdCode.set(result.participation?.verificationCode ?? null);
    const kind =
      origin === 'LEGACY' ? 'Participación histórica registrada' : 'Participación registrada';
    this.successMessage.set(
      `${kind}${student ? ` para ${student.lastName}, ${student.firstName}` : ''}.`
    );

    this.form.reset({
      eventId: '',
      studentId: '',
      grade: '',
      verificationCode: '',
    });
    this.foundStudent.set(null);
    this.studentSearchCode.set('');
    this.studentSearchError.set(null);
  }

  /** Importa codigos universitarios al evento seleccionado. */
  searchStudentByCode(): void {
    this.studentSearchError.set(null);
    this.foundStudent.set(null);
    const code = this.studentSearchCode().trim();
    if (!code) {
      this.studentSearchError.set('Ingrese el código de estudiante');
      return;
    }
    const event = this.selectedEvent();
    const student =
      this.eligibleStudents().find((item) => item.universityCode === code) ??
      this.studentService.findByUniversityCode(code);
    if (!student) {
      this.studentSearchError.set('Estudiante no encontrado');
      return;
    }
    if (student.status !== 'ACTIVE') {
      this.studentSearchError.set('El estudiante se encuentra inactivo');
      return;
    }
    if (event && this.participationService.exists(event.id, student.id)) {
      this.studentSearchError.set('El estudiante ya está registrado en este evento.');
      return;
    }
    this.foundStudent.set(student);
    this.form.patchValue({ studentId: String(student.id) });
  }

  clearStudentSearch(): void {
    this.studentSearchCode.set('');
    this.foundStudent.set(null);
    this.studentSearchError.set(null);
    this.form.patchValue({ studentId: '' });
  }

  // --- Solicitudes de carga (recargas) ---

  /** Abre el modal que registra una solicitud con su carga adjunta. */
  openNewRequest(): void {
    this.requestError.set(null);
    this.requestForm.reset({ requestedBy: '', reason: '' });
    this.requestText.set('');
    this.requestFileName.set(null);
    this.isRequestDragging.set(false);
    // Asegura que el combobox del modal muestre el evento ya seleccionado.
    this.modalEventId.setValue(this.form.controls.eventId.value);
    this.requestOpen.set(true);
  }

  closeNewRequest(): void {
    this.requestOpen.set(false);
  }

  confirmNewRequest(): void {
    this.requestForm.markAllAsTouched();
    this.requestError.set(null);

    const eventId = this.selectedEventId();
    if (!eventId) {
      this.requestError.set('Selecciona el evento antes de registrar la solicitud.');
      return;
    }

    const codes = parseDelimitedText(this.requestText(), 1)
      .map((row) => (row[0] ?? '').trim())
      .filter((code) => code.length > 0);
    if (codes.length === 0) {
      this.requestError.set('Adjunta la carga extemporánea: códigos o un archivo .txt/.csv.');
      return;
    }

    if (this.requestForm.invalid) {
      this.requestError.set('Indica quién sube la carga y el motivo de la demora.');
      return;
    }

    const value = this.requestForm.getRawValue();
    const request = this.loadRequestService.create({
      eventId,
      requestedBy: value.requestedBy,
      reason: value.reason,
      codes,
      fileName: this.requestFileName(),
    });

    if (!request) {
      this.requestError.set('No fue posible registrar la solicitud.');
      return;
    }

    this.requestOpen.set(false);
    this.successMessage.set(
      `Solicitud ${request.id} registrada con ${request.codes.length} código(s). Queda pendiente de aprobación.`
    );
  }

  /** Lee el archivo de la carga adjunta a la solicitud. */
  onRequestFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.readRequestFile(file);
    }
    input.value = '';
  }

  onRequestDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isRequestDragging.set(true);
  }

  onRequestDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isRequestDragging.set(false);
  }

  onRequestDrop(event: DragEvent): void {
    event.preventDefault();
    this.isRequestDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.readRequestFile(file);
    }
  }

  private async readRequestFile(file: File): Promise<void> {
    if (!isImportFileSupported(file)) {
      this.requestError.set('Formato no admitido. Usa un archivo .xlsx, .csv o .txt.');
      return;
    }

    try {
      const text = await readImportFileText(file);
      this.requestFileName.set(file.name);
      this.requestText.set(text);
      this.requestError.set(null);
    } catch {
      this.requestError.set('No se pudo leer el archivo seleccionado.');
    }
  }

  clearRequestFile(): void {
    this.requestFileName.set(null);
  }

  /** Abre el modal para aprobar o rechazar una solicitud pendiente. */
  openResolve(request: ParticipationLoadRequest): void {
    this.resolveError.set(null);
    this.resolvingRequest.set(request);
    this.resolveForm.reset({ decision: 'APPROVED', resolvedBy: '', note: '' });
    this.resolveOpen.set(true);
  }

  closeResolve(): void {
    this.resolveOpen.set(false);
    this.resolvingRequest.set(null);
  }

  async confirmResolve(): Promise<void> {
    this.resolveForm.markAllAsTouched();
    this.resolveError.set(null);

    const request = this.resolvingRequest();
    if (!request) {
      this.resolveError.set('No hay solicitud por resolver.');
      return;
    }

    if (this.resolveForm.invalid) {
      this.resolveError.set('Indica quién resuelve la solicitud.');
      return;
    }

    const value = this.resolveForm.getRawValue();
    const options = { resolvedBy: value.resolvedBy, note: value.note };

    const resolved =
      value.decision === 'APPROVED'
        ? await this.loadRequestService.approve(request.id, options)
        : this.loadRequestService.reject(request.id, options);

    if (!resolved) {
      this.resolveError.set('La solicitud ya fue resuelta.');
      return;
    }

    this.resolveOpen.set(false);
    this.resolvingRequest.set(null);
    if (value.decision === 'APPROVED') {
      this.successMessage.set(
        `Solicitud ${request.id} aprobada: ${resolved.registeredCount ?? 0} registrado(s), ${resolved.skippedCount ?? 0} omitido(s).`
      );
    } else {
      this.successMessage.set(`Solicitud ${request.id} rechazada.`);
    }
  }

  isPending(request: ParticipationLoadRequest): boolean {
    return request.status === 'PENDING';
  }

  requestStatusColor(status: LoadRequestStatus): BadgeColor {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      default:
        return 'warning';
    }
  }

  isLateBatch(batch: ParticipationImportBatch): boolean {
    return batch.mode === 'LATE';
  }

  batchModeLabel(batch: ParticipationImportBatch): string {
    return IMPORT_MODE_LABEL[batch.mode];
  }

  /** Fecha + hora legibles de un sello ISO. */
  formatStamp(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    return `${formatMediumDate(iso)} · ${formatTime(iso)}`;
  }

  // --- Asistente de importacion ---

  /**
   * Abre el asistente. Si el evento ya cerro su primera carga y no hay una
   * recarga habilitada, se ofrece primero registrar la solicitud de carga.
   */
  openImport(mode: ParticipationImportMode = 'NORMAL'): void {
    const event = this.selectedEvent();

    // Asegura que el combobox del modal muestre el evento ya seleccionado.
    this.modalEventId.setValue(this.form.controls.eventId.value);

    if (event && isImportCompleted(event) && !isLateImportsEnabled(event)) {
      this.openNewRequest();
      return;
    }

    this.resetImport();
    this.importOrigin.set(this.registerOrigin());
    this.importMode.set(event && isLateImportsEnabled(event) ? 'LATE' : mode);
    this.lateUploadedBy.set('');
    this.importError.set(null);
    this.importOpen.set(true);
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.requestOpen.set(false);
  }

  /** Cambia entre carga actual e historica y reinicia la validacion. */
  setImportOrigin(origin: ParticipationOrigin): void {
    if (this.importOrigin() === origin) {
      return;
    }

    this.importOrigin.set(origin);
    this.importStage1.set(null);
    this.importStage2.set(null);
    this.importErrors.set([]);
    this.importSummary.set(null);
    this.importError.set(null);
    this.importStep.set(1);
  }

  goToImportStep(step: ImportStep): void {
    // Solo se puede volver a un paso ya alcanzado.
    if (step <= this.importStep() || (step === 2 && this.importStage2()) || (step === 3 && this.importSummary())) {
      this.importStep.set(step);
    }
  }

  /** Paso 1 -> 2: lee los codigos y los valida contra el padron y el evento. */
  validateImport(): void {
    this.importError.set(null);
    this.importSummary.set(null);

    const eventId = this.selectedEventId();
    if (!eventId) {
      this.importError.set('Selecciona el evento antes de validar.');
      return;
    }

    const event = this.selectedEvent();
    if (event && !isRegistrationOpen(event)) {
      this.importError.set(
        'El registro de este evento está cerrado. Habilita las cargas extemporáneas para subir una lista posterior.'
      );
      return;
    }

    const legacy = this.importOrigin() === 'LEGACY';
    const parsed = parseDelimitedText(this.importText(), 1);
    const rows: { code: string; grade?: string; verificationCode?: string }[] = legacy
      ? parsed
          .map((row) => ({
            code: row[0] ?? '',
            verificationCode: row[1] ?? '',
            grade: row[2] ?? '',
          }))
          .filter((row) => row.code.trim() || row.verificationCode.trim() || row.grade.trim())
      : parsed
          .map((row) => ({ code: row[0] ?? '', grade: row[1] ?? '' }))
          .filter((row) => row.code.trim() || row.grade.trim());

    if (rows.length === 0) {
      this.importError.set('No se detectaron códigos para validar.');
      return;
    }

    const stage1 = this.participationService.importStage1(rows);
    const stage2 = this.participationService.importStage2(
      eventId,
      stage1.items,
      this.importOrigin()
    );

    this.importStage1.set(stage1);
    this.importStage2.set(stage2);
    this.importErrors.set(stage2.errors);
    this.importStep.set(2);
  }

  /** Paso 2 -> 3: confirma el registro de los items validados. */
  async confirmImport(): Promise<void> {
    this.importError.set(null);

    const eventId = this.selectedEventId();
    if (!eventId) {
      this.importError.set('Selecciona el evento antes de confirmar.');
      return;
    }

    const stage2 = this.importStage2();
    if (!stage2) {
      this.importError.set('Valida los códigos antes de confirmar.');
      return;
    }

    const validItems = stage2.items.filter((item) => item.valid);
    const summary = await this.participationService.importStage2Commit(eventId, validItems, {
      mode: this.importMode(),
      uploadedBy: this.lateUploadedBy(),
      origin: this.importOrigin(),
    });

    this.importSummary.set(summary);
    this.importErrors.set(summary.errors ?? stage2.errors);
    this.importStep.set(3);

    const prefix =
      summary.mode === 'LATE'
        ? 'Carga extemporánea registrada'
        : this.importOrigin() === 'LEGACY'
          ? 'Carga histórica completada'
          : 'Importación completada';
    this.successMessage.set(
      `${prefix}: ${summary.registered} registrado(s), ${summary.skipped} omitido(s).`
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.readImportFile(file);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.readImportFile(file);
    }
  }

  private async readImportFile(file: File): Promise<void> {
    if (!isImportFileSupported(file)) {
      this.importError.set('Formato no admitido. Usa un archivo .xlsx, .csv o .txt.');
      return;
    }

    try {
      const text = await readImportFileText(file);
      this.importFileName.set(file.name);
      this.importText.set(text);
      this.importError.set(null);
    } catch {
      this.importError.set('No se pudo leer el archivo seleccionado.');
    }
  }

  clearImportFile(): void {
    this.importFileName.set(null);
  }

  /**
   * Plantilla en blanco para rellenar en Excel: una sola fila de encabezado,
   * que el parser descarta al importar. La nota es opcional.
   */
  downloadImportTemplate(): void {
    const legacy = this.importOrigin() === 'LEGACY';

    void downloadXlsx({
      fileName: legacy
        ? 'DCredits_plantilla_participaciones_historicas'
        : 'DCredits_plantilla_codigos_participacion',
      sheetName: 'Codigos',
      rows: [
        legacy
          ? ['CÓDIGO UNIVERSITARIO', 'CÓDIGO DE VERIFICACIÓN', 'NOTA (opcional)']
          : ['CÓDIGO UNIVERSITARIO', 'NOTA (opcional)'],
      ],
    });
  }

  resetImport(): void {
    this.importText.set('');
    this.importFileName.set(null);
    this.importStage1.set(null);
    this.importStage2.set(null);
    this.importErrors.set([]);
    this.importSummary.set(null);
    this.importStep.set(1);
    this.importError.set(null);
  }

  downloadErrorReport(): void {
    const errors = this.importErrors();
    if (errors.length === 0) {
      return;
    }

    const now = new Date();
    const timestamp = now.toLocaleString('es-PE');
    let content = '=== REPORTE DE REGISTROS NO PROCESADOS ===\r\n';
    content += `Fecha/Hora: ${timestamp}\r\n`;
    content += `Total no procesados: ${errors.length}\r\n\r\n`;

    for (const error of errors) {
      content += `- Fila ${error.row} | Código: ${error.code || '[VACÍO]'} | Motivo: ${error.reason}\r\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateStr = now.toISOString().split('T')[0];
    anchor.href = url;
    anchor.download = `reporte_errores_importacion_${dateStr}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  stepCircleClass(id: ImportStep): string {
    if (this.importStep() === id) {
      return 'bg-brand-600 text-white shadow-theme-xs';
    }
    if (this.importStep() > id) {
      return 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300';
    }
    return 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400';
  }

  stepLabelClass(id: ImportStep): string {
    return this.importStep() >= id
      ? 'text-gray-900 dark:text-white/90'
      : 'text-gray-400 dark:text-gray-500';
  }

  statusColor(valid: boolean | undefined): BadgeColor {
    return valid ? 'success' : 'error';
  }

  isInvalid(control: 'eventId' | 'studentId' | 'verificationCode'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }
}
