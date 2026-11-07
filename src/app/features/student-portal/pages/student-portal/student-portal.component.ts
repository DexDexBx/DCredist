import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../../../core/services/theme.service';
import { StudentPortalService } from '../../../../core/services/student-portal.service';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { DcSelectComponent } from '../../../../shared/components/form/dc-select/dc-select.component';
import { DcSelectOption } from '../../../../shared/components/form/dc-select/dc-select.component';
import {
  StudentPortalHistoryItem,
  StudentPortalProfile,
  StudentPortalSchool,
} from '../../../../models/student-portal.model';
import { eventTypeLabel } from '../../../../models/academic-event.model';
import { formatDateRange, parseCalendarDate } from '../../../../shared/utils/date.utils';
import { maskSurnames } from '../../../../shared/utils/text.utils';

/**
 * PORTAL DEL ESTUDIANTE.
 *
 * Primera etapa: el estudiante valida su identidad con su codigo universitario
 * y su escuela profesional. Si ambos coinciden, ve su resumen de creditos.
 */
@Component({
  selector: 'app-student-portal',
  imports: [
    DcInputComponent,
    DcSelectComponent,
    IconComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './student-portal.component.html',
  styleUrl: './student-portal.component.css',
})
export class StudentPortalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly portalService = inject(StudentPortalService);
  readonly themeService = inject(ThemeService);

  readonly schools = signal<StudentPortalSchool[]>([]);
  readonly loadingSchools = signal(true);
  readonly schoolsError = signal<string | null>(null);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly student = signal<StudentPortalProfile | null>(null);

  // --- Celebración al alcanzar la meta ---
  readonly celebrationOpen = signal(false);
  readonly celebrationSeconds = signal(15);
  readonly codeCopied = signal(false);
  readonly celebrationCode = computed(() => this.student()?.constancy?.code ?? '');

  /** Posiciones y colores de las explosiones decorativas. */
  readonly celebrationBursts = [
    { left: 12, top: 24, delay: 0, color: '#fedb00' },
    { left: 82, top: 18, delay: 350, color: '#e06aa2' },
    { left: 24, top: 72, delay: 700, color: '#ffffff' },
    { left: 74, top: 66, delay: 1050, color: '#fedb00' },
    { left: 48, top: 12, delay: 1400, color: '#e06aa2' },
  ];
  readonly fireworkParticles = Array.from({ length: 12 }, (_, index) => ({
    angle: index * 30,
    distance: 70 + (index % 4) * 18,
    delay: index * 16,
  }));

  private readonly destroyRef = inject(DestroyRef);
  private celebrationTimer: number | null = null;
  private copyTimer: number | null = null;

  readonly schoolOptions = computed<DcSelectOption[]>(() =>
    this.schools().map((school) => ({ value: String(school.id), label: school.name })),
  );

  readonly form = this.fb.nonNullable.group({
    universityCode: ['', [Validators.required, Validators.pattern(/^\d{7}$/)]],
    professionalSchoolId: ['', [Validators.required]],
  });

  constructor() {
    void this.loadSchools();
    this.destroyRef.onDestroy(() => {
      this.clearCelebrationTimer();
      this.clearCopyTimer();
    });
  }

  async loadSchools(): Promise<void> {
    this.loadingSchools.set(true);
    this.schoolsError.set(null);

    try {
      this.schools.set(await this.portalService.listSchools());
    } catch {
      this.schoolsError.set(
        'No se pudieron cargar las escuelas profesionales. Intenta nuevamente.',
      );
    } finally {
      this.loadingSchools.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set(null);

    if (this.form.invalid || this.submitting()) {
      return;
    }

    const { universityCode, professionalSchoolId } = this.form.getRawValue();
    this.submitting.set(true);
    const result = await this.portalService.consult(
      universityCode,
      Number(professionalSchoolId),
    );
    this.submitting.set(false);

    if (result.ok) {
      this.student.set(result.student);

      if (result.student.completed) {
        this.openCelebration();
      } else {
        this.closeCelebration();
      }
      return;
    }

    this.error.set(result.message);
  }

  resetConsult(): void {
    this.closeCelebration();
    this.student.set(null);
    this.error.set(null);
    this.form.controls.universityCode.setValue('');
  }

  openCelebration(): void {
    this.clearCelebrationTimer();
    this.celebrationSeconds.set(15);
    this.celebrationOpen.set(true);

    this.celebrationTimer = window.setInterval(() => {
      const next = this.celebrationSeconds() - 1;
      this.celebrationSeconds.set(next);

      if (next <= 0) {
        this.closeCelebration();
      }
    }, 1000);
  }

  closeCelebration(): void {
    this.clearCelebrationTimer();
    this.celebrationOpen.set(false);
  }

  async copyConstancyCode(): Promise<void> {
    const code = this.celebrationCode();
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }

    this.codeCopied.set(true);
    this.clearCopyTimer();
    this.copyTimer = window.setTimeout(() => this.codeCopied.set(false), 2000);
  }

  private clearCelebrationTimer(): void {
    if (this.celebrationTimer !== null) {
      window.clearInterval(this.celebrationTimer);
      this.celebrationTimer = null;
    }
  }

  private clearCopyTimer(): void {
    if (this.copyTimer !== null) {
      window.clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
  }

  isInvalid(control: 'universityCode' | 'professionalSchoolId'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }

  progressWidth(): number {
    return Math.min(100, Math.max(0, this.student()?.progress ?? 0));
  }

  studentName(student: StudentPortalProfile): string {
    return `${maskSurnames(student.lastName)}, ${student.firstName}`;
  }

  /** Fecha del evento respetando los eventos de solo mes/anio. */
  eventDates(item: StudentPortalHistoryItem): string {
    if (item.eventDateType === 'SHORT') {
      const date = parseCalendarDate(item.eventStartDate);
      return date
        ? new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(date)
        : '';
    }

    return formatDateRange(item.eventStartDate, item.eventEndDate);
  }

  eventMeta(item: StudentPortalHistoryItem): string {
    return [eventTypeLabel(item.eventTypeName), item.modality].filter(Boolean).join(' · ');
  }

  statusLabel(status: string): string {
    if (status === 'VALID') {
      return 'Vigente';
    }
    if (status === 'CANCELLED') {
      return 'Anulada';
    }
    return 'Pendiente';
  }

  statusClass(status: string): string {
    if (status === 'VALID') {
      return 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400';
    }
    if (status === 'CANCELLED') {
      return 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400';
    }
    return 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400';
  }
}
