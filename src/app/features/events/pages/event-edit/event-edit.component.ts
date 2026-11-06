import { Component, computed, effect, inject, input, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { EventService } from '../../../../core/services/event.service';
import { EventTypeService } from '../../../../core/services/event-type.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import {
  EVENT_MODALITIES,
  EVENT_ORIGIN_LABEL,
  EVENT_STATUSES,
  EventDateType,
  EventDraft,
  EventModality,
  EventOrigin,
  EventStatus,
  eventTypeLabel,
  isHistoricalEventDate,
} from '../../../../models';
import { CatalogOption } from '../../../../models/catalog.model';
import { DcComboboxComponent } from '../../../../shared/components/form/dc-combobox/dc-combobox.component';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import {
  DcSelectComponent,
  DcSelectOption,
} from '../../../../shared/components/form/dc-select/dc-select.component';
import { DcTextareaComponent } from '../../../../shared/components/form/dc-textarea/dc-textarea.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

/** La descripcion es opcional; si llega debe tener 3+ caracteres. */
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

/** Secuencia de estados para usuarios que no son administradores. */
const STATUS_TRANSITIONS: Record<string, readonly EventStatus[]> = {
  Programado: ['En curso', 'Cancelado'],
  'En curso': ['Finalizado', 'Cancelado'],
  Finalizado: [],
  Cancelado: [],
};

@Component({
  selector: 'app-event-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DcComboboxComponent,
    DcInputComponent,
    DcSelectComponent,
    DcTextareaComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
  ],
  templateUrl: './event-edit.component.html',
})
export class EventEditComponent {
  private readonly eventService = inject(EventService);
  private readonly catalogService = inject(CatalogService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly id = input.required<string>();
  private readonly eventId = computed(() => Number(this.id()));
  readonly event = computed(() => this.eventService.findById(this.eventId()));

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly formError = signal<string | null>(null);

  readonly originLabel = EVENT_ORIGIN_LABEL;
  readonly isLegacy = computed(() => this.event()?.origin === 'LEGACY');

  readonly blocked = computed(() => {
    const event = this.event();
    if (!event || this.auth.currentUser()?.role === 'ADMIN') {
      return false;
    }
    return this.participationService.getByEvent(event.id).length > 0;
  });

  readonly modalityOptions = computed<DcSelectOption[]>(() =>
    (this.isLegacy()
      ? EVENT_MODALITIES
      : EVENT_MODALITIES.filter((modality) => modality !== 'No especificado')
    ).map((modality) => ({ value: modality, label: modality })),
  );

  readonly typeOptions = computed<DcSelectOption[]>(() => {
    const options = this.eventTypeService
      .activeTypes()
      // "No especificado" solo se ofrece en registros historicos.
      .filter((type) => this.isLegacy() || type.name !== 'Unspecified')
      .map((type) => ({
        value: String(type.id),
        label: type.label,
      }));

    const current = this.event();
    if (current && !options.some((option) => option.value === String(current.eventTypeId))) {
      options.unshift({
        value: String(current.eventTypeId),
        label: eventTypeLabel(current.eventTypeName),
      });
    }

    return options;
  });

  readonly organizerOptions = computed<DcSelectOption[]>(() =>
    this.catalogService.options('organizers').map((organizer) => ({
      value: String(organizer.id),
      label: organizer.name,
    })),
  );

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

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');

  readonly dateTypeSignal = signal<EventDateType>('LONG');
  readonly isShortDate = computed(() => this.dateTypeSignal() === 'SHORT');
  readonly dateInputType = computed(() => (this.isShortDate() ? 'month' : 'date'));

  readonly statusOptions = computed<DcSelectOption[]>(() => {
    // El administrador puede mover el estado libremente. El resto de roles
    // avanza en orden, tanto en registros actuales como historicos.
    if (this.isAdmin()) {
      return EVENT_STATUSES.map((status) => ({ value: status, label: status }));
    }

    const current = (this.event()?.status ?? 'Programado') as EventStatus;
    const next = STATUS_TRANSITIONS[current] ?? [];
    return [current, ...next].map((status) => ({ value: status, label: status }));
  });

  readonly statusLocked = computed(() => {
    if (this.isAdmin()) {
      return false;
    }
    const saved = this.event()?.status;
    return saved === 'Finalizado' || saved === 'Cancelado';
  });

  private initialized = false;

  constructor() {
    void this.eventTypeService.load();

    this.form.controls.dateType.valueChanges.subscribe((value) => {
      this.dateTypeSignal.set(value);
      this.applyDateTypeValidators(value);
      this.onDateTypeChange(value);
    });

    effect(() => {
      const control = this.form.controls.status;
      if (this.statusLocked()) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });

    effect(() => {
      const event = this.event();
      if (!event || this.initialized) {
        return;
      }

      this.initialized = true;
      this.applyOriginValidators(event.origin ?? 'CURRENT');

      // El registro actual siempre usa fecha completa; el selector de tipo de
      // fecha solo se ofrece para los eventos historicos.
      const dateType: EventDateType =
        event.origin === 'LEGACY' ? (event.dateType ?? 'LONG') : 'LONG';
      const startDate =
        dateType === 'SHORT'
          ? event.startDate.slice(0, 7)
          : isHistoricalEventDate(event.startDate)
            ? ''
            : event.startDate;
      const endDate =
        dateType === 'SHORT'
          ? ''
          : isHistoricalEventDate(event.endDate)
            ? ''
            : event.endDate;

      this.form.patchValue({
        name: event.name,
        description: event.description ?? '',
        eventTypeId: String(event.eventTypeId),
        dateType,
        startDate,
        endDate,
        modality:
          event.origin !== 'LEGACY' && event.modality === 'No especificado'
            ? ''
            : event.modality,
        location: event.location ?? '',
        status: event.status,
        capacity: String(event.capacity ?? 0),
        credits: String(event.credits),
        organizerId: String(event.organizerId),
        professionalSchoolId: String(event.professionalSchoolId),
      }, { emitEvent: false });

      // El patch inicial no emite valueChanges: sincronizamos la senal y los
      // validadores con el dateType guardado.
      this.dateTypeSignal.set(dateType);
      this.applyDateTypeValidators(dateType);
    });
  }

  /** Configura los validadores segun el origen guardado del evento. */
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
    this.saved.set(false);

    const current = this.event();
    if (!current || this.blocked() || this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const value = this.form.getRawValue();
    const isLegacy = this.isLegacy();
    // El registro actual guarda siempre fecha completa.
    const dateType: EventDateType = isLegacy
      ? (value.dateType as EventDateType)
      : 'LONG';

    const draft: EventDraft = {
      code: current.code,
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
      origin: isLegacy ? 'LEGACY' : 'CURRENT',
    };

    const validation = this.eventService.validate(draft);
    if (!validation.valid) {
      this.saving.set(false);
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del evento.');
      return;
    }

    const updated = await this.eventService.update(this.eventId(), draft);

    if (updated) {
      // El backend pudo corregir la fecha de las participaciones que heredaron
      // la fecha del evento: se refresca el historial para mostrarlo al dia.
      await this.participationService.refresh();
      this.saved.set(true);
      this.form.markAsPristine();
    } else {
      this.formError.set('No se pudo actualizar el evento. Intenta nuevamente.');
    }

    this.saving.set(false);
  }

  onCancel(): void {
    void this.router.navigate(['/events', this.eventId()]);
  }

  isInvalid(
    control:
      | 'name'
      | 'description'
      | 'eventTypeId'
      | 'startDate'
      | 'endDate'
      | 'modality'
      | 'status'
      | 'location'
      | 'organizerId'
      | 'professionalSchoolId'
      | 'credits'
      | 'capacity',
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
}
