import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { StudentService } from '../../../../core/services/student.service';
import { StudentDraft } from '../../../../models';
import { CatalogOption } from '../../../../models/catalog.model';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import {
  DcSelectComponent,
  DcSelectOption,
} from '../../../../shared/components/form/dc-select/dc-select.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

/**
 * EDICION DE ESTUDIANTES.
 *
 * Mismas reglas que el alta. El guardado es un PATCH real: `StudentService`
 * compara el borrador con el estudiante actual y envia solo los campos que
 * cambiaron. El estado no se edita aqui: se mantiene el actual.
 */
@Component({
  selector: 'app-student-edit',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DcInputComponent,
    DcSelectComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
  ],
  templateUrl: './student-edit.component.html',
})
export class StudentEditComponent {
  private readonly studentService = inject(StudentService);
  private readonly catalogService = inject(CatalogService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Identificador tomado de la ruta /students/:id/edit. */
  readonly id = input.required<string>();
  private readonly studentId = computed(() => Number(this.id()));
  readonly student = computed(() => this.studentService.findById(this.studentId()));

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly duplicateCode = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly schools = computed<CatalogOption[]>(() =>
    this.scopedSchools(this.catalogService.options('professionalSchools')),
  );
  readonly sites = computed<CatalogOption[]>(() =>
    this.catalogService.options('locations'),
  );

  readonly schoolOptions = computed<DcSelectOption[]>(() =>
    this.schools().map((school) => ({ value: String(school.id), label: school.name })),
  );

  readonly siteOptions = computed<DcSelectOption[]>(() =>
    this.sites().map((site) => ({ value: String(site.id), label: site.name })),
  );

  readonly form = this.fb.nonNullable.group({
    universityCode: ['', [Validators.required, Validators.pattern(/^\d{7}$/)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    professionalSchoolId: ['', [Validators.required]],
    locationId: ['', [Validators.required]],
  });

  private initialized = false;

  constructor() {
    // Copia el estudiante al formulario una sola vez.
    effect(() => {
      const student = this.student();
      if (!student || this.initialized) {
        return;
      }

      this.initialized = true;
      this.form.patchValue({
        universityCode: student.universityCode,
        lastName: student.lastName,
        firstName: student.firstName,
        professionalSchoolId: String(student.professionalSchoolId),
        locationId: String(student.locationId),
      });
    });
  }

  private scopedSchools(options: CatalogOption[]): CatalogOption[] {
    const user = this.auth.currentUser();
    if (!user || (user.professionalSchoolName ?? '').trim().toLowerCase() === 'general') {
      return options;
    }
    return options.filter((option) => option.id === user.professionalSchoolId);
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.duplicateCode.set(null);
    this.formError.set(null);
    this.saved.set(false);

    const current = this.student();
    if (!current || this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();

    if (this.studentService.existsUniversityCode(value.universityCode, this.studentId())) {
      this.duplicateCode.set(value.universityCode);
      return;
    }

    const professionalSchoolId = Number(value.professionalSchoolId);
    const locationId = Number(value.locationId);

    const draft: StudentDraft = {
      universityCode: value.universityCode,
      lastName: value.lastName,
      firstName: value.firstName,
      professionalSchoolId,
      professionalSchool: this.catalogService.nameOf(
        'professionalSchools',
        professionalSchoolId,
      ),
      locationId,
      location: this.catalogService.nameOf('locations', locationId),
      // El estado se gestiona desde la ficha; aqui se conserva.
      status: current.status,
    };

    this.saving.set(true);
    const updated = await this.studentService.update(this.studentId(), draft);
    this.saving.set(false);

    if (updated) {
      this.saved.set(true);
      this.form.markAsPristine();
    } else {
      this.formError.set('No se pudo actualizar el estudiante. Intenta nuevamente.');
    }
  }

  onCancel(): void {
    void this.router.navigate(['/students', this.studentId()]);
  }

  isInvalid(
    control:
      | 'universityCode'
      | 'lastName'
      | 'firstName'
      | 'professionalSchoolId'
      | 'locationId',
  ): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }
}
