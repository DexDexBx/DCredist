import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { EventService } from '../../../../core/services/event.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ExportService } from '../../../../core/services/export.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import {
  AcademicEvent,
  ExportResult,
  INSTITUTIONAL_EXPORT_COLUMNS,
  PARTICIPATION_STATUS_LABEL,
  ParticipationContext,
  ParticipationStatus,
  eventTypeLabel,
  isImportCompleted,
  isLateImportsEnabled,
  isRegistrationOpen,
} from '../../../../models';
import {
  BadgeColor,
  BadgeComponent,
} from '../../../../shared/components/ui/badge/badge.component';
import { CertificateCodeComponent } from '../../../../shared/components/ui/certificate-code/certificate-code.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { PARTICIPATION_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import {
  formatDateRange,
  formatLongDate,
  formatSchedule,
} from '../../../../shared/utils/date.utils';
import { EventStatusBadgeComponent } from '../../components/event-status-badge/event-status-badge.component';

@Component({
  selector: 'app-event-detail',
  imports: [
    RouterLink,
    BadgeComponent,
    CertificateCodeComponent,
    EmptyStateComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    EventStatusBadgeComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent {
  private readonly eventService = inject(EventService);
  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);
  private readonly exportService = inject(ExportService);
  readonly auth = inject(AuthService);

  /**
   * Identificador del evento tomado de la ruta /events/:id.
   *
   * `alias: 'id'` es obligatorio: withComponentInputBinding expone el parametro
   * de ruta con el nombre del path ("id"). Sin el alias, este input nunca
   * recibe el valor y el detalle cae siempre en "Evento no encontrado".
   */
  readonly eventId = input.required<string>({ alias: 'id' });

  /** La ruta entrega el id como texto; los servicios lo usan numerico. */
  private readonly eventIdNumber = computed(() => Number(this.eventId()));

  readonly statusLabel = PARTICIPATION_STATUS_LABEL;
  readonly institutionalColumns = INSTITUTIONAL_EXPORT_COLUMNS;

  readonly lastExport = signal<ExportResult | null>(null);
  readonly cancelledId = signal<number | null>(null);

  /** Modal que explica por que no se puede editar (evento con estudiantes). */
  readonly blockedEdit = signal(false);
  readonly exportOpen = signal(false);
  readonly copied = signal(false);

  openExport(): void {
    this.lastExport.set(null);
    this.exportOpen.set(true);
  }

  closeExport(): void {
    this.exportOpen.set(false);
  }

  copyCode(): void {
    const code = this.event()?.code;
    if (!code) {
      return;
    }
    void navigator.clipboard?.writeText(code);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  readonly event = computed<AcademicEvent | undefined>(() =>
    this.eventService.findById(this.eventIdNumber())
  );

  readonly rows = computed<ParticipationContext[]>(() =>
    this.participationService.getEventTable(this.eventIdNumber())
  );

  readonly pageSizes = [10, 20, 50];
  readonly pageSize = signal(10);

  /**
   * Página visible de participantes. Vuelve a 1 al cambiar de evento o de
   * tamaño de página, para no quedar en una página vacía.
   */
  readonly page = linkedSignal({
    source: () => `${this.eventId()}|${this.pageSize()}`,
    computation: () => 1,
  });

  readonly pageData = computed(() => {
    const items = this.rows();
    const total = items.length;
    const pageSize = this.pageSize();
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, this.page()), pageCount);
    const start = (current - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page: current,
      pageCount,
      from: total === 0 ? 0 : start + 1,
      to: Math.min(total, start + pageSize),
      pageSize,
      offset: start,
    };
  });

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
  }

  readonly registeredCount = computed(
    () => this.participationService.countForEvent(this.eventIdNumber(), true)
  );

  readonly validCredits = computed(() =>
    Math.round(
      this.rows()
        .filter((row) => row.participation.status === 'VALID')
        .reduce((total, row) => total + row.participation.credits, 0) *
        100
    ) / 100
  );

  readonly pendingGrades = computed(
    () =>
      this.rows().filter(
        (row) =>
          row.participation.status === 'VALID' && row.participation.grade === 'sin nota'
      ).length
  );

  readonly acceptsRegistrations = computed(() => {
    const event = this.event();
    return event ? isRegistrationOpen(event) : false;
  });

  readonly registrationClosed = computed(() => {
    const event = this.event();
    if (!event || event.status === 'Cancelado') {
      return false;
    }
    return isImportCompleted(event) && !isLateImportsEnabled(event);
  });

  readonly lateImportsEnabled = computed(() => {
    const event = this.event();
    return event ? isLateImportsEnabled(event) : false;
  });


  fillRate(event: AcademicEvent): number {
    if (!event.capacity) {
      return 0;
    }
    return Math.min(100, Math.round((this.registeredCount() / event.capacity) * 100));
  }

  formatLongDate(value: string): string {
    return formatLongDate(value);
  }

  formatRange(event: AcademicEvent): string {
    return formatDateRange(event.startDate, event.endDate);
  }

  eventTypeName(event: AcademicEvent): string {
    return eventTypeLabel(event.eventTypeName);
  }

  formatSchedule(event: AcademicEvent): string {
    return formatDateRange(event.startDate, event.endDate);
  }

  participationStatusColor(status: ParticipationStatus): BadgeColor {
    return PARTICIPATION_STATUS_COLOR[status];
  }

  studentName(row: ParticipationContext): string {
    const student = row.student;
    return student ? `${student.lastName}, ${student.firstName}` : 'Estudiante no encontrado';
  }

  requestEdit(): void {
    const current = this.event();
    if (!current || !this.auth.can('events', 'MANAGE')) {
      return;
    }

    const hasParticipants = this.participationService.countForEvent(current.id, false) > 0;

    if (hasParticipants && this.auth.currentUser()?.role !== 'ADMIN') {
      this.blockedEdit.set(true);
      return;
    }

    void this.router.navigate(['/events', current.id, 'edit']);
  }

  closeBlockedEdit(): void {
    this.blockedEdit.set(false);
  }

  export(): void {
    this.lastExport.set(this.exportService.downloadEventParticipants(this.eventIdNumber()));
  }

  /** Anula una participacion: deja de sumar creditos, pero conserva el codigo. */
  cancelParticipation(participationId: number): void {
    void this.participationService.cancel(participationId);
    this.cancelledId.set(participationId);
  }

  reactivateParticipation(participationId: number): void {
    void this.participationService.update(participationId, { status: 'VALID' });
    this.cancelledId.set(null);
  }
}
