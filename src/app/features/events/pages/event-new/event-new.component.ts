import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventService } from '../../../../core/services/event.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { EventTypeService } from '../../../../core/services/event-type.service';
import {
  EVENT_MODALITIES,
  EVENT_STATUSES,
  EventDraft,
  EventModality,
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
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

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

  /**
   * Estados disponibles al CREAR un evento. `Cancelado` se reserva para la
   * edicion posterior: un evento nuevo no nace cancelado.
   */
  readonly statusOptions: DcSelectOption[] = EVENT_STATUSES.filter(
    (status) => status !== 'Cancelado',
  ).map((status) => ({
    value: status,
    label: status,
  }));

  readonly modalityOptions: DcSelectOption[] = EVENT_MODALITIES.map((modality) => ({
    value: modality,
    label: modality,
  }));

  /** Tipos de evento del API, con el nombre visible en espanol. */
  readonly typeOptions = computed<DcSelectOption[]>(() =>
    this.eventTypeService.activeTypes().map((type) => ({
      value: String(type.id),
      label: type.label,
    })),
  );

  /** Los organizadores salen del catalogo administrable. */
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
      .filter(
        (option) => global || option.id === user?.professionalSchoolId,
      )
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
      credits: [
        '1',
        [
          Validators.required,
          Validators.min(1),
          Validators.max(21),
          Validators.pattern(/^\d{1,2}(\.\d{1,2})?$/),
        ],
      ],
      organizerId: ['', [Validators.required]],
      professionalSchoolId: ['', [Validators.required]],
    },
    { validators: [endAfterStartDate] }
  );

  constructor() {
    void this.eventTypeService.load();

    const fecha = this.route.snapshot.queryParamMap.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      this.form.patchValue({ startDate: fecha });
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

    const draft: EventDraft = {
      name: value.name,
      description: value.description,
      eventTypeId: Number(value.eventTypeId),
      startDate: value.startDate,
      endDate: value.endDate,
      modality: value.modality as EventModality,
      location: value.location,
      status: value.status as EventStatus,
      capacity: value.capacity ? Number(value.capacity) : 0,
      credits: Number(value.credits),
      organizerId: Number(value.organizerId),
      professionalSchoolId: Number(value.professionalSchoolId),
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
      // El formulario queda listo para registrar otro evento.
      this.form.reset({
        name: '',
        description: '',
        eventTypeId: '',
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
  ): boolean {
    const field = this.form.controls[control];
    if (!field.touched) {
      return false;
    }
    if (field.invalid) {
      return true;
    }
    // El rango de fechas es una validación del grupo: se marca en la fecha de fin.
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
