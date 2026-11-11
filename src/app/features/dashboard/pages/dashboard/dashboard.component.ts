import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CreditService } from '../../../../core/services/credit.service';
import { AuthService } from '../../../../core/services/auth.service';
import { StudentService } from '../../../../core/services/student.service';
import { ApiHydrationService } from '../../../../core/services/api-hydration.service';
import { DcreditsApiClient } from '../../../../core/api/dcredits-api.client';
import {
  ApiDashboardCreditsProgress,
  ApiDashboardEvent,
  ApiDashboardReport,
} from '../../../../core/api/api.types';
import {
  AcademicEvent,
  EventModality,
  EventStatus,
  eventDateRangeLabel,
} from '../../../../models';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { CreditProgressComponent } from '../../../../shared/components/ui/credit-progress/credit-progress.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { EventStatusBadgeComponent } from '../../../events/components/event-status-badge/event-status-badge.component';

/** Evento de la agenda breve: hoy primero, luego los siguientes. */
interface AgendaItem {
  event: AcademicEvent;
  today: boolean;
}

const EMPTY_PROGRESS: ApiDashboardCreditsProgress = {
  creditsTarget: 21,
  totalCredits: 0,
  remainingCredits: 0,
  averageProgress: 0,
  studentsCompleted: 0,
  studentsWithCredits: 0,
  totalStudents: 0,
};

const EVENT_STATUS: Record<string, EventStatus> = {
  DRAFT: 'Programado',
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
};

const EVENT_MODALITY: Record<string, EventModality> = {
  PRESENTIAL: 'Presencial',
  VIRTUAL: 'Virtual',
  HYBRID: 'Híbrido',
  UNSPECIFIED: 'No especificado',
};

function mapDashboardEvent(row: ApiDashboardEvent): AcademicEvent {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: '',
    eventTypeId: row.eventTypeId,
    eventTypeName: row.eventTypeName,
    startDate: row.startDate.slice(0, 10),
    endDate: row.endDate.slice(0, 10),
    dateType: 'LONG',
    modality: EVENT_MODALITY[row.modality] ?? 'No especificado',
    location: row.location,
    status: EVENT_STATUS[row.status] ?? 'Programado',
    capacity: row.capacity,
    organizerId: row.organizerId,
    organizer: row.organizer,
    professionalSchoolId: row.professionalSchoolId,
    professionalSchool: row.professionalSchool,
    origin: 'CURRENT',
    userCreate: '',
    userUpdate: '',
    credits: row.credits,
  };
}

/**
 * DASHBOARD: resumen compacto.
 *
 * Las cifras salen del endpoint agregado `/reports/dashboard`; no se cargan
 * todas las participaciones ni todo el padrón para pintar el inicio.
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    CreditProgressComponent,
    PanelComponent,
    ModalComponent,
    StatCardComponent,
    PageHeaderComponent,
    IconComponent,
    EventStatusBadgeComponent,
  ],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly api = inject(DcreditsApiClient);
  private readonly studentService = inject(StudentService);
  private readonly creditService = inject(CreditService);
  private readonly hydration = inject(ApiHydrationService);
  readonly auth = inject(AuthService);

  readonly report = signal<ApiDashboardReport | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  constructor() {
    void this.loadReport();
  }

  private async loadReport(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      this.report.set(await firstValueFrom(this.api.getDashboardReport()));
    } catch {
      this.loadError.set('No se pudo cargar el resumen del dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  readonly totalEvents = computed(() => this.report()?.totalEvents ?? 0);
  readonly activeEvents = computed(() => this.report()?.activeEvents ?? 0);
  readonly totalStudents = computed(() => this.report()?.totalStudents ?? 0);
  readonly totalParticipations = computed(() => this.report()?.totalParticipations ?? 0);
  readonly validParticipations = computed(() => this.report()?.validParticipations ?? 0);
  readonly cancelledParticipations = computed(() => this.report()?.cancelledParticipations ?? 0);
  readonly totalCredits = computed(() => this.report()?.totalCredits ?? 0);
  readonly creditsProgress = computed<ApiDashboardCreditsProgress>(
    () => this.report()?.creditsProgress ?? EMPTY_PROGRESS
  );
  readonly creditsTarget = computed(() => this.creditsProgress().creditsTarget);

  readonly agenda = computed<AgendaItem[]>(() => {
    const current = this.report();
    if (!current) {
      return [];
    }

    return [
      ...current.todayEvents.map((event) => ({
        event: mapDashboardEvent(event),
        today: true,
      })),
      ...current.nextEvents.map((event) => ({
        event: mapDashboardEvent(event),
        today: false,
      })),
    ].slice(0, 4);
  });

  readonly schoolsTop = computed(() => this.report()?.schoolSummaries.slice(0, 5) ?? []);
  readonly schoolsAll = computed(() => this.report()?.schoolSummaries ?? []);
  readonly topStudents = computed(() => this.report()?.topStudents ?? []);

  /** Estudiantes que ya alcanzaron la meta, para el modal de detalle. */
  readonly graduatedStudents = computed(() =>
    this.studentService
      .students()
      .map((student) => ({
        student,
        summary: this.creditService.getStudentCreditSummary(student.id),
      }))
      .filter((item) => item.summary.completed)
      .sort((a, b) => b.summary.totalCredits - a.summary.totalCredits)
  );

  readonly creditsDetailOpen = signal(false);
  readonly schoolsDetailOpen = signal(false);

  readonly graduatedLoading = computed(
    () => this.hydration.loadingStudents() || this.hydration.loadingParticipations()
  );

  openCreditsDetail(): void {
    this.creditsDetailOpen.set(true);
    void Promise.all([
      this.hydration.ensureStudents(),
      this.hydration.ensureParticipations(),
    ]);
  }

  closeCreditsDetail(): void {
    this.creditsDetailOpen.set(false);
  }

  openSchoolsDetail(): void {
    this.schoolsDetailOpen.set(true);
  }

  closeSchoolsDetail(): void {
    this.schoolsDetailOpen.set(false);
  }

  formatSchedule(event: AcademicEvent): string {
    return eventDateRangeLabel(event);
  }

  maxSchoolCredits(): number {
    return this.schoolsTop()[0]?.totalCredits ?? 1;
  }

  maxStudentCredits(): number {
    return this.topStudents()[0]?.credits ?? 1;
  }

  /** Avance individual, para la barra de cada estudiante en el modal. */
  progressOf(studentId: number): number {
    return this.creditService.getStudentCreditSummary(studentId).progress;
  }
}
