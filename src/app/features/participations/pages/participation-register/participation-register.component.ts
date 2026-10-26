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
  PARTICIPATION_TYPE_LABEL,
  ParticipationImportBatch,
  ParticipationImportMode,
  ParticipationLoadRequest,
  ParticipationType,
  acceptsParticipations,
  eventLoadState,
  isImportCompleted,
  isLateImportsEnabled,
  isRegistrationOpen,
} from '../../../../models';
import { formatMediumDate, formatTime } from '../../../../shared/utils/date.utils';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { DcComboboxComponent } from '../../../../shared/components/form/dc-combobox/dc-combobox.component';
import { DcSelectComponent, DcSelectOption } from '../../../../shared/components/form/dc-select/dc-select.component';
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
    DcSelectComponent,
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

  // --- Asistente de importacion (modal) ---
  readonly importOpen = signal(false);
  readonly importStep = signal<ImportStep>(1);
  readonly importText = signal('');
  readonly importFileName = signal<string | null>(null);
  readonly isDragging = signal(false);
  /** Cantidad de estudiantes activos del padron que carga "Cargar ejemplo". */
  readonly exampleCount = signal(2500);
  readonly importError = signal<string | null>(null);
  readonly importStage1 = signal<ParticipationImportStage1Result | null>(null);
  readonly importStage2 = signal<ParticipationImportStage2Result | null>(null);
  readonly importErrors = signal<ParticipationImportError[]>([]);
  readonly importSummary = signal<ParticipationImportSummary | null>(null);

  // --- Modo de la carga y trazabilidad de extemporaneos ---
  readonly importMode = signal<ParticipationImportMode>('NORMAL');
  readonly lateUploadedBy = signal('');

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

  readonly form = this.fb.nonNullable.group({
    eventId: ['', [Validators.required]],
    studentId: ['', [Validators.required]],
    participationType: ['ASISTENTE' as ParticipationType, [Validators.required]],
    // dc-input es un ControlValueAccessor de texto: se coacciona al enviar.
    credits: ['0', [Validators.required]],
    grade: [''],
  });

  private readonly eventIdSignal = toSignal(
    this.form.controls.eventId.valueChanges,
    { initialValue: this.form.controls.eventId.value }
  );

  readonly selectedEventId = computed(() => this.eventIdSignal() || '');

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
    this.openEvents().map((event) => ({
      value: event.id,
      label: `${event.code} · ${event.name}`,
      description: [event.organizer, `${event.credits} crd.`]
        .filter((part): part is string => Boolean(part))
        .join(' · '),
      search: `${event.code} ${event.name} ${event.organizer ?? ''} ${event.modality}`,
    }))
  );

  readonly studentOptions = computed<DcSelectOption[]>(() =>
    this.studentService
      .getStudents({ status: 'ACTIVE' })
      .map((student) => ({
        value: student.id,
        label: `${student.universityCode} · ${student.lastName}, ${student.firstName}`,
        search: `${student.universityCode} ${student.lastName} ${student.firstName}`,
        description: student.professionalSchool
          ? `${student.professionalSchool}${student.headquarters ? ' · ' + student.headquarters : ''}`
          : student.headquarters,
      }))
  );

  readonly typeOptions: DcSelectOption[] = (
    Object.keys(PARTICIPATION_TYPE_LABEL) as ParticipationType[]
  ).map((type) => ({ value: type, label: PARTICIPATION_TYPE_LABEL[type] }));

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

    // Los creditos por defecto siguen al evento elegido, pero el valor siempre
    // puede ser ajustado a mano antes de registrar.
    effect(() => {
      const event = this.selectedEvent();
      if (event) {
        this.form.patchValue({ credits: String(event.credits) });
      }
    });
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.createdCode.set(null);

    const eventId = this.selectedEventId();
    if (!eventId) {
      this.errorMessage.set('Selecciona el evento del registro.');
      return;
    }

    const value = this.form.getRawValue();

    const result = await this.participationService.register({
      eventId,
      studentId: value.studentId,
      participationType: value.participationType,
      credits: Number(value.credits),
      grade: value.grade === '' ? null : Number(value.grade),
    });

    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'No fue posible registrar la participación.');
      return;
    }

    const student = this.studentService.findById(value.studentId);
    this.createdCode.set(result.participation?.verificationCode ?? null);
    this.successMessage.set(
      `Participación registrada${student ? ` para ${student.lastName}, ${student.firstName}` : ''}.`
    );

    this.form.patchValue({ grade: '' });
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
    const student = this.studentService.findByUniversityCode(code);
    if (!student) {
      this.studentSearchError.set('Estudiante no encontrado');
      return;
    }
    if (student.status !== 'ACTIVE') {
      this.studentSearchError.set('El estudiante se encuentra inactivo');
      return;
    }
    this.foundStudent.set(student);
    this.form.patchValue({ studentId: student.id });
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
    this.importMode.set(event && isLateImportsEnabled(event) ? 'LATE' : mode);
    this.lateUploadedBy.set('');
    this.importError.set(null);
    this.importOpen.set(true);
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.requestOpen.set(false);
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

    const codes = parseDelimitedText(this.importText(), 1).map((row) => (row[0] ?? ''));
    if (codes.length === 0) {
      this.importError.set('No se detectaron códigos para validar.');
      return;
    }

    const stage1 = this.participationService.importStage1(codes);
    const stage2 = this.participationService.importStage2(eventId, stage1.items);

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
    });

    this.importSummary.set(summary);
    this.importErrors.set(summary.errors ?? stage2.errors);
    this.importStep.set(3);

    const prefix =
      summary.mode === 'LATE' ? 'Carga extemporánea registrada' : 'Importación completada';
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
   * Carga estudiantes reales del padron como ejemplo de lista. El texto lleva
   * codigo y nombre (la segunda columna es solo referencia: al importar se usa
   * el codigo de la primera columna).
   */
  loadExample(): void {
    const requested = Math.max(1, Math.trunc(this.exampleCount() || 0));
    const students = this.studentService.getStudents({ status: 'ACTIVE' }).slice(0, requested);

    this.importFileName.set(null);
    this.importText.set(
      students
        .map(
          (student) =>
            `${student.universityCode};${student.lastName}, ${student.firstName}`
        )
        .join('\n')
    );
    this.exampleCount.set(students.length);
  }

  /**
   * Plantilla en blanco para rellenar en Excel: una sola fila de encabezado,
   * que el parser descarta al importar. Nombre y nota son columnas de
   * referencia: la nota se deja en blanco cuando no se requiere.
   */
  downloadImportTemplate(): void {
    void downloadXlsx({
      fileName: 'DCredits_plantilla_codigos_participacion',
      sheetName: 'Codigos',
      rows: [
        [
          'CÓDIGO UNIVERSITARIO',
          'NOMBRE DEL ESTUDIANTE (referencia, no se importa)',
          'NOTA (opcional, no se importa)',
        ],
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

  isInvalid(control: 'eventId' | 'studentId' | 'credits'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }
}
