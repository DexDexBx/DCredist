import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
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
  eventDateRangeLabel,
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
import { isHistoricalEventDate } from '../../../../models';
import { PARTICIPATION_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import { formatLongDate as formatLongDateValue } from '../../../../shared/utils/date.utils';
import {
  matchesTokens,
  normalizeForSearch,
  searchTokens,
} from '../../../../shared/utils/text.utils';
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

  // --- Anular / reactivar con motivo ---
  readonly statusModal = signal<{
    row: ParticipationContext;
    action: 'CANCEL' | 'REACTIVATE';
  } | null>(null);
  readonly statusReason = signal('');
  readonly statusError = signal<string | null>(null);
  readonly statusSaving = signal(false);

  // --- Eliminacion definitiva de participaciones (solo administradores) ---
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'ADMIN');
  readonly deleteTarget = signal<ParticipationContext | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly deleting = signal(false);

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

  /** Texto que la persona escribe en el buscador de participantes. */
  readonly searchInput = signal('');

  /** Texto ya estabilizado: evita filtrar en cada tecla. */
  readonly search = toSignal(
    toObservable(this.searchInput).pipe(debounceTime(200), distinctUntilChanged()),
    { initialValue: '' }
  );

  readonly filteredRows = computed<ParticipationContext[]>(() => {
    const tokens = searchTokens(this.search());
    if (tokens.length === 0) {
      return this.rows();
    }

    return this.rows().filter((row) => {
      const student = row.student;
      const haystack = normalizeForSearch(
        [
          student?.universityCode,
          student?.lastName,
          student?.firstName,
          student?.professionalSchool,
          student?.location,
          row.participation.verificationCode,
          row.participation.legacyCode,
          row.participation.grade,
          this.statusLabel[row.participation.status],
        ]
          .filter(Boolean)
          .join(' ')
      );

      return matchesTokens(haystack, tokens);
    });
  });

  clearSearch(): void {
    this.searchInput.set('');
  }

  readonly pageSizes = [10, 20, 50];
  readonly pageSize = signal(10);

  /**
   * Página visible de participantes. Vuelve a 1 al cambiar de evento o de
   * tamaño de página, para no quedar en una página vacía.
   */
  readonly page = linkedSignal({
    source: () => `${this.eventId()}|${this.pageSize()}|${this.search()}`,
    computation: () => 1,
  });

  readonly pageData = computed(() => {
    const items = this.filteredRows();
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

  eventLongDate(event: AcademicEvent): string {
    if (event.dateType === 'SHORT') {
      return eventDateRangeLabel(event);
    }
    return isHistoricalEventDate(event.startDate)
      ? 'Sin fecha'
      : formatLongDateValue(event.startDate);
  }

  formatRange(event: AcademicEvent): string {
    return eventDateRangeLabel(event);
  }

  eventTypeName(event: AcademicEvent): string {
    return eventTypeLabel(event.eventTypeName);
  }

  formatSchedule(event: AcademicEvent): string {
    return eventDateRangeLabel(event);
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

  /** Abre el modal de anulacion o reactivacion con su motivo. */
  openStatusModal(row: ParticipationContext, action: 'CANCEL' | 'REACTIVATE'): void {
    this.statusReason.set('');
    this.statusError.set(null);
    this.statusModal.set({ row, action });
  }

  closeStatusModal(): void {
    this.statusModal.set(null);
    this.statusReason.set('');
    this.statusError.set(null);
  }

  async confirmStatusChange(): Promise<void> {
    const modal = this.statusModal();
    if (!modal) {
      return;
    }

    const reason = this.statusReason().trim();
    if (!reason) {
      this.statusError.set(
        modal.action === 'CANCEL'
          ? 'Escribe el motivo de la anulación.'
          : 'Escribe el motivo de la reactivación.'
      );
      return;
    }

    this.statusSaving.set(true);
    const result = await this.participationService.update(modal.row.participation.id, {
      status: modal.action === 'CANCEL' ? 'CANCELLED' : 'VALID',
      descriptionStatus: reason,
    });
    this.statusSaving.set(false);

    if (result) {
      this.closeStatusModal();
      return;
    }

    this.statusError.set('No se pudo actualizar la participación. Intenta nuevamente.');
  }

  requestDeleteParticipation(row: ParticipationContext): void {
    if (!this.isAdmin()) {
      return;
    }

    this.deleteError.set(null);
    this.deleteTarget.set(row);
  }

  closeDeleteParticipation(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
  }

  async confirmDeleteParticipation(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }

    this.deleting.set(true);
    const result = await this.participationService.delete(target.participation.id);
    this.deleting.set(false);

    if (result.ok) {
      this.deleteTarget.set(null);
      return;
    }

    this.deleteError.set(result.message ?? 'No se pudo eliminar la participación.');
  }
}
