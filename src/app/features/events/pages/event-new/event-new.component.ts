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
import {
  EVENT_MODALITIES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EventModality,
  EventStatus,
  EventType,
} from '../../../../models';
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly submitting = signal(false);
  readonly createdCode = signal<string | null>(null);
  readonly createdId = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly statusOptions: DcSelectOption[] = EVENT_STATUSES.map((status) => ({
    value: status,
    label: status,
  }));

  readonly modalityOptions: DcSelectOption[] = EVENT_MODALITIES.map((modality) => ({
    value: modality,
    label: modality,
  }));

  readonly typeOptions: DcSelectOption[] = EVENT_TYPES.map((type) => ({
    value: type,
    label: type,
  }));

  /** Los organizadores salen del catalogo administrable. */
  readonly organizerOptions = computed<DcSelectOption[]>(() =>
    this.catalogService.names('organizers').map((organizer) => ({
      value: organizer,
      label: organizer,
    })),
  );

  readonly form = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      eventType: ['Congreso' as EventType, [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: ['', [Validators.required]],
      modality: ['Presencial' as EventModality, [Validators.required]],
      location: ['', [Validators.required, Validators.minLength(3)]],
      status: ['Programado' as EventStatus, [Validators.required]],
      capacity: ['0', [Validators.pattern(/^(\d{1,9})?$/)]],
      credits: ['1', [Validators.required, Validators.pattern(/^\d{1,7}(\.\d{1,2})?$/)]],
      organizer: ['', [Validators.required, Validators.minLength(3)]],
      tags: ['', [Validators.pattern(/^[a-zA-ZáéíóúñÁÉÍÓÚÑüÜ\s,]*$/)]],
    },
    { validators: [endAfterStartDate] }
  );

  constructor() {
    const fecha = this.route.snapshot.queryParamMap.get('fecha');
    if (fecha && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha)) {
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

    const validation = this.eventService.validate({
      name: value.name,
      description: value.description,
      eventType: value.eventType,
      startDate: value.startDate,
      endDate: value.endDate,
      modality: value.modality,
      location: value.location,
      status: value.status,
      capacity: value.capacity ? Number(value.capacity) : null,
      credits: Number(value.credits),
      organizer: value.organizer,
      tags: value.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    if (!validation.valid) {
      this.submitting.set(false);
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del evento.');
      return;
    }

    const event = await this.eventService.create({
      name: value.name,
      description: value.description,
      eventType: value.eventType,
      startDate: value.startDate,
      endDate: value.endDate,
      modality: value.modality,
      location: value.location,
      status: value.status,
      capacity: value.capacity ? Number(value.capacity) : null,
      credits: Number(value.credits),
      organizer: value.organizer,
      tags: value.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    if (event) {
      this.createdCode.set(event.code);
      this.createdId.set(event.id);
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
      | 'startDate'
      | 'endDate'
      | 'location'
      | 'organizer'
      | 'credits'
      | 'capacity'
      | 'tags'
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
