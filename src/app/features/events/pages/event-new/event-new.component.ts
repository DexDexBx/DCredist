import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventService, EventImportResult, EventImportRow } from '../../../../core/services/event.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { EventTypeService } from '../../../../core/services/event-type.service';
import {
  EVENT_MODALITIES,
  EVENT_ORIGIN_LABEL,
  EVENT_STATUSES,
  EventDateType,
  EventDraft,
  EventModality,
  EventOrigin,
  EventStatus,
} from '../../../../models';
import { CatalogOption } from '../../../../models/catalog.model';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { DcComboboxComponent } from '../../../../shared/components/form/dc-combobox/dc-combobox.component';
import {
  DcSelectComponent,
  DcSelectOption,
} from '../../../../shared/components/form/dc-select/dc-select.component';
import { DcTextareaComponent } from '../../../../shared/components/form/dc-textarea/dc-textarea.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import {
  IMPORT_FILE_ACCEPT,
  isImportFileSupported,
  readImportFileText,
} from '../../../../shared/utils/import-file.utils';
import { downloadXlsx } from '../../../../shared/utils/xlsx.utils';

/** Validacion: la descripcion es opcional, pero si llega debe tener 3+ caracteres. */
function optionalMinLength(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').trim();
    if (!value) {
      return null;
    }
    return value.length >= min ? null : { minlength: true };
  };
}

/** Valida el formato YYYY-MM del input de mes y anio. */
function monthYearFormat(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}$/.test(value) ? null : { monthYear: true };
}

/** La fecha de fin no puede ser anterior a la de inicio. */
function endAfterStartDate(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;

  if (!start || !end) {
    return null;
  }

  const startId = new Date(start).getTime();
  const endId = new Date(end).getTime();

  if (Number.isNaN(startId) || Number.isNaN(endId) || endId >= startId) {
    return null;
  }

  return { endBeforeStart: true };
}

/** Encabezados de la plantilla de importacion de eventos. */
/**
 * Encabezados de la plantilla de importacion de eventos.
 *
 * Las fechas son obligatorias en ambos modos. Con fecha completa se piden
 * inicio y fin; con solo mes/anio se usa el inicio (YYYY-MM) y el fin se
 * ignora. Descripcion, ubicacion y capacidad solo son obligatorias en el
 * registro actual.
 */
function buildImportHeaders(isLegacy: boolean, dateType: EventDateType): string[] {
  return [
    'Nombre',
    isLegacy ? 'Descripción' : 'Descripción *',
    dateType === 'SHORT' ? 'Fecha de inicio (mes y año) *' : 'Fecha de inicio *',
    dateType === 'SHORT' ? 'Fecha de fin (se ignora)' : 'Fecha de fin *',
    'Tipo de evento',
    'Modalidad',
    isLegacy ? 'Ubicación' : 'Ubicación *',
    'Estado',
    isLegacy ? 'Capacidad' : 'Capacidad *',
    'Créditos',
    'Organizador',
    'Escuela',
  ];
}

@Component({
  selector: 'app-event-new',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DcInputComponent,
    DcComboboxComponent,
    DcSelectComponent,
    DcTextareaComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    PanelComponent,
  ],
  templateUrl: './event-new.component.html',
})
export class EventNewComponent {
  private readonly eventService = inject(EventService);
  private readonly catalogService = inject(CatalogService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly createdCode = signal<string | null>(null);
  readonly createdId = signal<number | null>(null);
  readonly formError = signal<string | null>(null);

  // --- Tipo de registro ---
  readonly originModalOpen = signal(false);
  readonly origin = signal<EventOrigin>('CURRENT');
  readonly originLabel = EVENT_ORIGIN_LABEL;
  readonly isLegacy = computed(() => this.origin() === 'LEGACY');

  /** Estados al crear: los actuales excluyen "Cancelado"; los historicos admiten todos. */
  readonly statusOptions = computed<DcSelectOption[]>(() =>
    (this.isLegacy() ? EVENT_STATUSES : EVENT_STATUSES.filter((s) => s !== 'Cancelado')).map(
      (status) => ({ value: status, label: status }),
    )
  );

  readonly modalityOptions: DcSelectOption[] = EVENT_MODALITIES.map((modality) => ({
    value: modality,
    label: modality,
  }));

  readonly typeOptions = computed<DcSelectOption[]>(() =>
    this.eventTypeService.activeTypes().map((type) => ({
      value: String(type.id),
      label: type.label,
    })),
  );

  readonly organizerOptions = computed<DcSelectOption[]>(() =>
    this.catalogService.options('organizers').map((organizer) => ({
      value: String(organizer.id),
      label: organizer.name,
    })),
  );

  /** Escuelas reales: un actor de escuela solo puede crear eventos de la suya. */
  readonly schoolOptions = computed<DcSelectOption[]>(() => {
    const user = this.auth.currentUser();
    const global =
      !user || (user.professionalSchoolName ?? '').trim().toLowerCase() === 'general';
    const options: CatalogOption[] = this.catalogService.options('professionalSchools');

    return options
      .filter((option) => global || option.id === user?.professionalSchoolId)
      .map((option) => ({ value: String(option.id), label: option.name }));
  });

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [optionalMinLength(3)]],
      dateType: ['LONG' as EventDateType, [Validators.required]],
      eventTypeId: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      modality: ['', [Validators.required]],
      location: [''],
      status: ['', [Validators.required]],
      capacity: ['0', [Validators.pattern(/^(\d{1,9})?$/)]],
      credits: [
        '1',
        [
          Validators.required,
          Validators.min(0),
          Validators.max(21),
          Validators.pattern(/^\d{1,2}(\.\d{1,2})?$/),
        ],
      ],
      organizerId: ['', [Validators.required]],
      professionalSchoolId: ['', [Validators.required]],
    },
    { validators: [endAfterStartDate] },
  );

  private readonly dateTypeValue = toSignal(
    this.form.controls.dateType.valueChanges,
    { initialValue: this.form.controls.dateType.value },
  );

  readonly isShortDate = computed(() => this.dateTypeValue() === 'SHORT');
  readonly dateInputType = computed(() => (this.isShortDate() ? 'month' : 'date'));

  // --- Importacion masiva ---
  readonly importOpen = signal(false);
  readonly importOrigin = signal<EventOrigin>('CURRENT');
  readonly isLegacyImport = computed(() => this.importOrigin() === 'LEGACY');
  readonly importDateType = signal<EventDateType>('LONG');
  readonly isShortImportDate = computed(() => this.importDateType() === 'SHORT');
  readonly importStep = signal<1 | 2>(1);
  readonly importText = signal('');
  readonly importFileName = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly importError = signal<string | null>(null);
  readonly importResult = signal<EventImportResult | null>(null);
  readonly fileAccept = IMPORT_FILE_ACCEPT;

  constructor() {
    void this.eventTypeService.load();
    this.applyOriginValidators(this.origin());
    this.form.controls.dateType.valueChanges.subscribe((value) => {
      this.applyDateTypeValidators(value);
      this.onDateTypeChange(value);
    });

    const fecha = this.route.snapshot.queryParamMap.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.form.patchValue({ startDate: fecha });
    }
  }

  // --- Tipo de registro ---

  openOriginModal(): void {
    this.originModalOpen.set(true);
  }

  closeOriginModal(): void {
    this.originModalOpen.set(false);
  }

  selectOrigin(origin: EventOrigin): void {
    this.origin.set(origin);
    this.applyOriginValidators(origin);
    this.originModalOpen.set(false);
    this.formError.set(null);

    if (!this.isLegacy()) {
      this.form.controls.status.setValue('');
      this.form.controls.modality.setValue('');
    }
  }

  /** Configura los validadores segun el tipo de registro (actual vs historico). */
  private applyOriginValidators(origin: EventOrigin): void {
    const isLegacy = origin === 'LEGACY';
    const required = Validators.required;
    const controls = this.form.controls;

    // Descripcion, ubicacion y capacidad son obligatorias SOLO en el registro
    // actual; en el historico siguen siendo opcionales.
    controls.description.setValidators(
      isLegacy ? [optionalMinLength(3)] : [required, optionalMinLength(3)]
    );
    controls.location.setValidators(isLegacy ? [] : [required]);
    controls.capacity.setValidators(
      isLegacy
        ? [Validators.pattern(/^(\d{1,9})?$/)]
        : [required, Validators.pattern(/^\d{1,9}$/)]
    );
    controls.eventTypeId.setValidators(isLegacy ? [] : [required]);
    // Las fechas son obligatorias en ambos modos; su formato lo decide dateType.
    controls.startDate.setValidators([required]);
    controls.modality.setValidators(isLegacy ? [] : [required]);
    controls.status.setValidators(isLegacy ? [] : [required]);
    this.applyDateTypeValidators(controls.dateType.value);

    for (const name of [
      'description',
      'location',
      'capacity',
      'eventTypeId',
      'startDate',
      'modality',
      'status',
    ] as const) {
      controls[name].updateValueAndValidity();
    }
  }

  private applyDateTypeValidators(dateType: EventDateType): void {
    const required = Validators.required;
    const controls = this.form.controls;

    if (dateType === 'SHORT') {
      controls.startDate.setValidators([required, monthYearFormat]);
      controls.endDate.setValidators([]);
    } else {
      controls.startDate.setValidators([required]);
      controls.endDate.setValidators([required]);
    }

    controls.startDate.updateValueAndValidity();
    controls.endDate.updateValueAndValidity();
  }

  /** Ajusta los valores al cambiar entre fecha completa y solo mes/anio. */
  private onDateTypeChange(dateType: EventDateType): void {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;

    if (dateType === 'SHORT') {
      const month = /^\d{4}-\d{2}/.test(start) ? start.slice(0, 7) : '';
      this.form.patchValue({ startDate: month, endDate: '' }, { emitEvent: false });
      return;
    }

    if (/^\d{4}-\d{2}$/.test(start)) {
      const full = `${start}-29`;
      this.form.patchValue({ startDate: full, endDate: end || full }, { emitEvent: false });
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);

    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    const value = this.form.getRawValue();
    const isLegacy = this.isLegacy();
    const dateType = value.dateType as EventDateType;

    const draft: EventDraft = {
      name: value.name,
      description: value.description,
      eventTypeId: value.eventTypeId ? Number(value.eventTypeId) : null,
      startDate: value.startDate,
      endDate: dateType === 'SHORT' ? '' : value.endDate,
      dateType,
      modality: (value.modality || (isLegacy ? 'No especificado' : '')) as EventModality,
      location: value.location,
      status: (value.status || (isLegacy ? 'Finalizado' : '')) as EventStatus,
      capacity: value.capacity ? Number(value.capacity) : 0,
      credits: Number(value.credits),
      organizerId: Number(value.organizerId),
      professionalSchoolId: Number(value.professionalSchoolId),
      origin: this.origin(),
    };

    const validation = this.eventService.validate(draft);
    if (!validation.valid) {
      this.submitting.set(false);
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del evento.');
      return;
    }

    const event = await this.eventService.create(draft);

    if (event) {
      this.createdCode.set(event.code);
      this.createdId.set(event.id);
      this.form.reset({
        name: '',
        description: '',
        eventTypeId: '',
        dateType: 'LONG',
        startDate: '',
        endDate: '',
        modality: '',
        location: '',
        status: '',
        capacity: '0',
        credits: '1',
        organizerId: '',
        professionalSchoolId: '',
      });
    } else {
      this.formError.set('No se pudo registrar el evento. Intenta nuevamente.');
    }

    this.submitting.set(false);
  }

  onCancel(): void {
    void this.router.navigate(['/events']);
  }

  isInvalid(
    control:
      | 'name'
      | 'description'
      | 'eventTypeId'
      | 'startDate'
      | 'endDate'
      | 'location'
      | 'organizerId'
      | 'professionalSchoolId'
      | 'credits'
      | 'capacity'
      | 'modality'
      | 'status',
  ): boolean {
    const field = this.form.controls[control];
    if (!field.touched) {
      return false;
    }
    if (field.invalid) {
      return true;
    }
    return control === 'endDate' && this.form.errors !== null;
  }

  // --- Importacion masiva ---

  openImport(): void {
    this.resetImport();
    this.importOrigin.set(this.origin());
    this.importDateType.set('LONG');
    this.importOpen.set(true);
  }

  setImportDateType(dateType: EventDateType): void {
    if (this.importDateType() === dateType) {
      return;
    }
    this.importDateType.set(dateType);
    this.importResult.set(null);
    this.importStep.set(1);
    this.importError.set(null);
  }

  closeImport(): void {
    this.importOpen.set(false);
  }

  setImportOrigin(origin: EventOrigin): void {
    if (this.importOrigin() === origin) {
      return;
    }
    this.importOrigin.set(origin);
    this.importResult.set(null);
    this.importStep.set(1);
    this.importError.set(null);
  }

  resetImport(): void {
    this.importText.set('');
    this.importFileName.set(null);
    this.importError.set(null);
    this.importResult.set(null);
    this.importStep.set(1);
  }

  downloadImportTemplate(): void {
    void downloadXlsx({
      fileName: this.isLegacyImport()
        ? 'DCredits_plantilla_eventos_historicos'
        : 'DCredits_plantilla_eventos',
      sheetName: 'Eventos',
      rows: [buildImportHeaders(this.isLegacyImport(), this.importDateType())],
      catalogSheets: [
        { name: 'Escuelas', header: 'Escuela', values: this.schoolOptions().map((o) => o.label) },
        {
          name: 'Organizadores',
          header: 'Organizador',
          values: this.catalogService.options('organizers').map((o) => o.name),
        },
        { name: 'Modalidad', header: 'Modalidad', values: [...EVENT_MODALITIES] },
        {
          name: 'Tipos de evento',
          header: 'Tipo de evento',
          values: this.eventTypeService.activeTypes().map((t) => t.label),
        },
        { name: 'Estados', header: 'Estado', values: [...EVENT_STATUSES] },
      ],
      listValidations: [
        { column: 5, catalog: 'Tipos de evento', error: 'Selecciona un tipo de evento de la lista.' },
        { column: 6, catalog: 'Modalidad', error: 'Selecciona una modalidad de la lista.' },
        { column: 8, catalog: 'Estados', error: 'Selecciona un estado de la lista.' },
        { column: 11, catalog: 'Organizadores', error: 'Selecciona un organizador de la lista.' },
        { column: 12, catalog: 'Escuelas', error: 'Selecciona una escuela de la lista.' },
      ],
    });
  }

  async confirmImport(): Promise<void> {
    this.importError.set(null);

    const rows = this.parseImportRows(this.importText());
    if (rows.length === 0) {
      this.importError.set('No se detectaron filas para importar.');
      return;
    }

    const result = await this.eventService.importEvents(
      rows,
      this.importOrigin(),
      this.importDateType()
    );
    this.importResult.set(result);
    this.importStep.set(2);

    if (result.registered > 0) {
      this.createdCode.set(null);
      this.createdId.set(null);
    }
  }

  private parseImportRows(text: string): EventImportRow[] {
    const lines = text
      .replace(/^\uFEFF/, '')
      .split(/\r\n|\n|\r/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const rows = lines
      .map((line) => {
        const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : line.includes(',') ? ',' : '';
        const cells = delimiter ? line.split(delimiter).map((cell) => cell.trim()) : [line.trim()];
        return cells;
      })
      .filter((cells, index) => !(index === 0 && this.isHeaderRow(cells)));

    return rows
      .filter((cells) => cells.some((cell) => cell.length > 0))
      .map((cells) => ({
        name: cells[0] ?? '',
        // Los campos opcionales vacios viajan como undefined: si se enviaran
        // como "", el API los rechazaria como fecha/valor invalido.
        description: cells[1]?.trim() || undefined,
        startDate: cells[2]?.trim() || undefined,
        endDate: cells[3]?.trim() || undefined,
        eventType: cells[4]?.trim() || undefined,
        modality: cells[5]?.trim() || undefined,
        location: cells[6]?.trim() || undefined,
        status: cells[7]?.trim() || undefined,
        capacity: cells[8]?.trim() ? Number(cells[8]) : undefined,
        credits: cells[9]?.trim() ? Number(cells[9]) : undefined,
        organizer: cells[10]?.trim() ?? '',
        professionalSchool: cells[11]?.trim() ?? '',
      }));
  }

  private isHeaderRow(cells: string[]): boolean {
    const first = (cells[0] ?? '').trim().toLowerCase();
    return (
      first === 'nombre' ||
      first === 'name' ||
      first === 'nombre del evento' ||
      /descripc/i.test(first)
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

  /** Cantidad de filas detectadas en el texto/archivo cargado. */
  readonly importPreviewCount = computed(() => this.parseImportRows(this.importText()).length);
}
