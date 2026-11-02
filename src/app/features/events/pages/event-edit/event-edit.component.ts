import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
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
  EVENT_STATUSES,
  EventDraft,
  EventModality,
  EventStatus,
  eventTypeLabel,
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

/**
 * EDICION DE EVENTOS.
 *
 * Reutiliza las mismas reglas del alta. El guardado es un PATCH real: solo se
 * envian los campos que cambiaron (lo resuelve `EventService.update`).
 *
 * Regla de negocio: un evento con estudiantes asociados solo lo puede editar
 * un administrador. Para los demas roles se muestra el bloqueo; el backend
 * vuelve a validar la misma regla.
 */
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

  /** Identificador tomado de la ruta /events/:id/edit. */
  readonly id = input.required<string>();
  private readonly eventId = computed(() => Number(this.id()));
  readonly event = computed(() => this.eventService.findById(this.eventId()));

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly formError = signal<string | null>(null);

  /** Un evento con participaciones queda reservado al administrador. */
  readonly blocked = computed(() => {
    const event = this.event();
    if (!event || this.auth.currentUser()?.role === 'ADMIN') {
      return false;
    }
    return this.participationService.getByEvent(event.id).length > 0;
  });

  readonly modalityOptions: DcSelectOption[] = EVENT_MODALITIES.map((modality) => ({
    value: modality,
    label: modality,
  }));

  readonly typeOptions = computed<DcSelectOption[]>(() => {
    const options = this.eventTypeService.activeTypes().map((type) => ({
      value: String(type.id),
      label: type.label,
    }));

    // Si el evento usa un tipo que luego se desactivo, se conserva como opcion
    // para que la edicion no obligue a cambiarlo sin motivo.
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
      description: ['', [Validators.required, Validators.minLength(20)]],
      eventTypeId: ['', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      modality: ['', [Validators.required]],
      location: ['', [Validators.required, Validators.minLength(3)]],
      status: ['', [Validators.required]],
      capacity: ['0', [Validators.pattern(/^(\d{1,9})?$/)]],
      credits: ['1', [Validators.required, Validators.pattern(/^\d{1,7}(\.\d{1,2})?$/)]],
      organizerId: ['', [Validators.required]],
      professionalSchoolId: ['', [Validators.required]],
    },
    { validators: [endAfterStartDate] },
  );

  /** Estado elegido en el formulario (puede diferir del guardado). */
  private readonly statusValue = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });

  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');

  /**
   * Transiciones permitidas para quien no es administrador. El estado actual
   * se muestra como opcion deshabilitada; solo se ofrecen los pasos posibles.
   */
  readonly statusOptions = computed<DcSelectOption[]>(() => {
    if (this.isAdmin()) {
      return EVENT_STATUSES.map((status) => ({ value: status, label: status }));
    }

    const current = (this.statusValue() || this.event()?.status || 'Programado') as EventStatus;
    const next = STATUS_TRANSITIONS[current] ?? [];

    return [current, ...next].map((status, index) => ({
      value: status,
      label: status,
      disabled: index === 0,
    }));
  });

  /** Finalizado y Cancelado cierran la secuencia: el estado queda bloqueado. */
  readonly statusLocked = computed(() => {
    if (this.isAdmin()) {
      return false;
    }
    const current = this.statusValue();
    return current === 'Finalizado' || current === 'Cancelado';
  });

  private initialized = false;

  constructor() {
    void this.eventTypeService.load();

    // El estado solo avanza: al llegar a un estado terminal se bloquea.
    effect(() => {
      const control = this.form.controls.status;
      if (this.statusLocked()) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });

    // Copia el evento al formulario una sola vez, cuando la hidratacion ya lo
    // tiene disponible.
    effect(() => {
      const event = this.event();
      if (!event || this.initialized) {
        return;
      }

      this.initialized = true;
      this.form.patchValue({
        name: event.name,
        description: event.description ?? '',
        eventTypeId: String(event.eventTypeId),
        startDate: event.startDate,
        endDate: event.endDate,
        modality: event.modality,
        location: event.location ?? '',
        status: event.status,
        capacity: event.capacity ? String(event.capacity) : '0',
        credits: String(event.credits),
        organizerId: String(event.organizerId),
        professionalSchoolId: String(event.professionalSchoolId),
      });
    });
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

    const draft: EventDraft = {
      code: current.code,
      name: value.name,
      description: value.description,
      eventTypeId: Number(value.eventTypeId),
      startDate: value.startDate,
      endDate: value.endDate,
      modality: value.modality as EventModality,
      location: value.location,
      status: value.status as EventStatus,
      capacity: value.capacity ? Number(value.capacity) : null,
      credits: Number(value.credits),
      organizerId: Number(value.organizerId),
      professionalSchoolId: Number(value.professionalSchoolId),
      tags: [],
    };

    const validation = this.eventService.validate(draft);
    if (!validation.valid) {
      this.saving.set(false);
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del evento.');
      return;
    }

    const updated = await this.eventService.update(this.eventId(), draft);

    if (updated) {
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
    // El rango de fechas es una validacion del grupo: se marca en la fecha de fin.
    return control === 'endDate' && this.form.errors !== null;
  }
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
