import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { EventService } from '../../../../core/services/event.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  DEFAULT_PARTICIPATION_PAGE_SIZE,
  PARTICIPATION_SORT_OPTIONS,
  PARTICIPATION_STATUS_LABEL,
  PARTICIPATION_TYPE_LABEL,
  ParticipationContext,
  ParticipationQuery,
  ParticipationSortKey,
  ParticipationStatus,
  ParticipationType,
  isLateParticipation,
  primaryCertificateCode,
} from '../../../../models';
import {
  BadgeColor,
  BadgeComponent,
} from '../../../../shared/components/ui/badge/badge.component';
import { CertificateCodeComponent } from '../../../../shared/components/ui/certificate-code/certificate-code.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { DcComboboxComponent } from '../../../../shared/components/form/dc-combobox/dc-combobox.component';
import { DcSelectOption } from '../../../../shared/components/form/dc-select/dc-select.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { PARTICIPATION_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import { formatMediumDate } from '../../../../shared/utils/date.utils';
import { ExportService } from '../../../../core/services/export.service';
import { AuthService } from '../../../../core/services/auth.service';

/**
 * CONSULTA DE PARTICIPACIONES.
 *
 * Va paginada por la misma razon que el padron de estudiantes: el historial
 * supera el millon de filas, asi que la vista pide solo la pagina que pinta y
 * los totales, nunca la lista completa.
 */
@Component({
  selector: 'dc-participation-list',
  imports: [
    BadgeComponent,
    CertificateCodeComponent,
    DcComboboxComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    RouterLink,
    StatCardComponent,
  ],
  templateUrl: './participation-list.component.html',
})
export class ParticipationListComponent {
  private readonly participationService = inject(ParticipationService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly exportService = inject(ExportService);
  readonly auth = inject(AuthService);

  readonly statusLabel = PARTICIPATION_STATUS_LABEL;
  readonly typeLabel = PARTICIPATION_TYPE_LABEL;
  readonly sortOptions = PARTICIPATION_SORT_OPTIONS;
  readonly pageSizes = [25, 50, 100, 200];

  /** Lo que la persona escribe. Se escribe aqui, se busca alli. */
  readonly searchInput = signal('');

  /**
   * Texto realmente buscado.
   *
   * Sin este retardo, cada tecla recalcularia el historial entero. Se busca
   * cuando la persona deja de teclear.
   */
  readonly search = toSignal(
    toObservable(this.searchInput).pipe(debounceTime(250), distinctUntilChanged()),
    { initialValue: '' }
  );

  readonly eventId = signal('');
  readonly type = signal<ParticipationType | ''>('');
  readonly status = signal<ParticipationStatus | 'Todos'>('Todos');
  readonly sort = signal<ParticipationSortKey>('recent');
  readonly pageSize = signal(DEFAULT_PARTICIPATION_PAGE_SIZE);

  /**
   * Pagina visible.
   *
   * `linkedSignal`: vale 1 mientras los filtros no cambien, y en cuanto cambian
   * vuelve a 1 sola. Sin esto, filtrar en la pagina 40 deja a la persona
   * mirando una pagina vacia.
   */
  readonly page = linkedSignal({
    source: () =>
      `${this.search()}|${this.eventId()}|${this.type()}|${this.status()}|${this.sort()}`,
    computation: () => 1,
  });

  readonly events = this.eventService.events;
  readonly types = this.participationService.participationTypes;

  /**
   * Eventos como opciones del combobox.
   *
   * El `<select>` nativo obligaba a recorrer una lista larga a ojo; aqui se
   * escribe y se filtra por codigo, nombre u organizador.
   */
  readonly eventOptions = computed<DcSelectOption[]>(() =>
    this.events().map((event) => ({
      value: event.id,
      label: event.code ? `${event.code} · ${event.name}` : event.name,
      description: [event.organizer, event.modality].filter(Boolean).join(' · '),
      search: `${event.code ?? ''} ${event.name} ${event.organizer ?? ''}`,
    }))
  );

  readonly query = computed<ParticipationQuery>(() => {
    const currentStatus = this.status();
    return {
      search: this.search(),
      eventId: this.eventId() || undefined,
      participationType: this.type() || undefined,
      status: currentStatus === 'Todos' ? undefined : currentStatus,
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  });

  /**
   * Los filtros, sin la pagina.
   *
   * Es lo que usan el resumen y la exportacion: describen el conjunto completo
   * que la persona esta mirando, no las 25 filas de la pantalla.
   */
  readonly filterQuery = computed<ParticipationQuery>(() => {
    const { page: _page, pageSize: _pageSize, ...filters } = this.query();
    return filters;
  });

  readonly pageData = computed(() => this.participationService.getParticipationsPage(this.query()));

  /** Los codigos pendientes de migrar alimentan el aviso y el acceso al modulo. */
  readonly summary = computed(() => this.participationService.summarize(this.filterQuery()));

  readonly rows = computed<ParticipationContext[]>(() =>
    this.pageData().items.map((participation) => this.participationService.context(participation))
  );

  readonly hasResults = computed(() => this.pageData().total > 0);

  /** Los totales del historial son de seis cifras: necesitan separador de miles. */
  formatCount(value: number): string {
    return new Intl.NumberFormat('es-PE').format(value);
  }

  /** Aviso de exportacion: el archivo sale de lo filtrado, no de la pantalla. */
  readonly exportNote = computed(
    () =>
      `Exporta las ${this.formatCount(this.summary().total)} participaciones que cumplen los filtros, no solo las ${this.pageData().pageSize} de esta página.`
  );

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
  }

  onSortChange(sort: ParticipationSortKey): void {
    this.sort.set(sort);
  }

  exportInstitutional(): void {
    this.exportService.downloadParticipationList(this.filterQuery());
  }

  statusColor(status: ParticipationStatus): BadgeColor {
    return PARTICIPATION_STATUS_COLOR[status];
  }

  /** Registro que llego por una recarga extemporanea. */
  isLate(row: ParticipationContext): boolean {
    return isLateParticipation(row.participation);
  }

  studentName(row: ParticipationContext): string {
    const student = row.student;
    return student ? `${student.lastName}, ${student.firstName}` : 'Estudiante no encontrado';
  }

  studentCode(row: ParticipationContext): string {
    return row.student?.universityCode ?? '';
  }

  studentHref(row: ParticipationContext): string[] {
    return ['/students', row.student?.id ?? ''];
  }

  eventName(row: ParticipationContext): string {
    return row.event?.name ?? 'Evento no disponible';
  }

  eventHref(row: ParticipationContext): string[] {
    return ['/events', row.event?.id ?? ''];
  }

  date(value: string): string {
    return formatMediumDate(value);
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.eventId.set('');
    this.type.set('');
    this.status.set('Todos');
  }

  hasFilters(): boolean {
    return Boolean(this.search() || this.eventId() || this.type() || this.status() !== 'Todos');
  }

  studentCount(): number {
    return this.studentService.totalCount();
  }

  /** El certificado siempre tiene UN codigo visible: el DC si existe, si no el anterior. */
  hasCertificate(row: ParticipationContext): boolean {
    return primaryCertificateCode(row.participation) !== null;
  }
}