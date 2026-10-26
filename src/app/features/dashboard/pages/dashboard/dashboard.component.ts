import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreditService } from '../../../../core/services/credit.service';
import { AuthService } from '../../../../core/services/auth.service';
import { EventService } from '../../../../core/services/event.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import { StudentService } from '../../../../core/services/student.service';
import { AcademicEvent } from '../../../../models';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { CreditProgressComponent } from '../../../../shared/components/ui/credit-progress/credit-progress.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { formatSchedule, isSameDay } from '../../../../shared/utils/date.utils';
import { EventStatusBadgeComponent } from '../../../events/components/event-status-badge/event-status-badge.component';

/** Evento de la agenda breve: hoy primero, luego los siguientes. */
interface AgendaItem {
  event: AcademicEvent;
  today: boolean;
}

/**
 * DASHBOARD: resumen compacto.
 *
 * Muestra solo las cifras clave y un par de graficos; las listas largas (ranking
 * de estudiantes, detalle por escuela) viven en modales para que la pantalla se
 * lea de un vistazo. Todas las cifras provienen del dominio real de DCredits.
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
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);
  private readonly creditService = inject(CreditService);
  readonly auth = inject(AuthService);

  readonly totalEvents = computed(() => this.eventService.events().length);
  readonly activeEvents = computed(() => this.eventService.activeEvents().length);
  readonly totalStudents = computed(() => this.studentService.totalCount());
  readonly totalParticipations = computed(() => this.participationService.participations().length);
  readonly totalCredits = this.creditService.globalTotalCredits;

  /** Avance global hacia la meta institucional de creditos. */
  readonly creditsProgress = this.creditService.creditsProgress;

  /** Meta vigente (21 por defecto). */
  readonly creditsTarget = this.creditService.creditsTarget;

  readonly todayEvents = computed(() =>
    this.eventService
      .events()
      .filter((event) => isSameDay(event.startDate, new Date()))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  );

  readonly nextEvents = computed<AcademicEvent[]>(() =>
    this.eventService
      .upcomingEvents()
      .filter((event) => !isSameDay(event.startDate, new Date()))
      .slice(0, 5)
  );

  /** Agenda breve: los eventos de hoy y los mas proximos, acotada a 4 filas. */
  readonly agenda = computed<AgendaItem[]>(() =>
    [
      ...this.todayEvents().map((event) => ({ event, today: true })),
      ...this.nextEvents().map((event) => ({ event, today: false })),
    ].slice(0, 4)
  );

  /** Top 5 de escuelas por creditos: lo que se ve en el grafico resumido. */
  readonly schoolsTop = computed(() => this.creditService.getSchoolSummaries().slice(0, 5));

  /** Todas las escuelas: contenido del modal de detalle. */
  readonly schoolsAll = computed(() => this.creditService.getSchoolSummaries());

  /** Ranking de estudiantes: contenido del modal de detalle. */
  readonly topStudents = computed(() => this.creditService.topStudents(10));

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

  openCreditsDetail(): void {
    this.creditsDetailOpen.set(true);
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
    return formatSchedule(event.startDate, event.endDate);
  }

  maxSchoolCredits(): number {
    return this.schoolsTop()[0]?.totalCredits ?? 1;
  }

  maxStudentCredits(): number {
    return this.topStudents()[0]?.credits ?? 1;
  }

  /** Avance individual, para la barra de cada estudiante en el modal. */
  progressOf(studentId: string): number {
    return this.creditService.getStudentCreditSummary(studentId).progress;
  }
}
