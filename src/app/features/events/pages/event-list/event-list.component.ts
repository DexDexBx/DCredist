import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventService } from '../../../../core/services/event.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ExportService } from '../../../../core/services/export.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import {
  AcademicEvent,
  EVENT_MODALITIES,
  EVENT_STATUSES,
  EVENT_TYPES,
  EventModality,
  EventStatus,
  EventType,
  ExportResult,
} from '../../../../models';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { formatDateTimeRange } from '../../../../shared/utils/date.utils';
import { EventStatusBadgeComponent } from '../../components/event-status-badge/event-status-badge.component';

type EventSortKey = 'name' | 'date' | 'type' | 'modality' | 'credits' | 'capacity' | 'status';
type SortDirection = 'asc' | 'desc';

/** Compara dos eventos por la columna pedida. */
function compareEvents(a: AcademicEvent, b: AcademicEvent, key: EventSortKey): number {
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name);
    case 'date':
      return a.startDate.localeCompare(b.startDate);
    case 'type':
      return a.eventType.localeCompare(b.eventType);
    case 'modality':
      return a.modality.localeCompare(b.modality);
    case 'credits':
      return a.credits - b.credits;
    case 'capacity':
      return (a.capacity ?? Number.POSITIVE_INFINITY) - (b.capacity ?? Number.POSITIVE_INFINITY);
    case 'status':
      return a.status.localeCompare(b.status);
  }
}

@Component({
  selector: 'app-event-list',
  imports: [
    RouterLink,
    EmptyStateComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    EventStatusBadgeComponent,
  ],
  templateUrl: './event-list.component.html',
})
export class EventListComponent {
  private readonly eventService = inject(EventService);
  private readonly participationService = inject(ParticipationService);
  private readonly exportService = inject(ExportService);
  readonly auth = inject(AuthService);

  readonly statuses = EVENT_STATUSES;
  readonly modalities = EVENT_MODALITIES;
  readonly types = EVENT_TYPES;
  readonly pageSizes = [3, 10, 20, 50];

  /** Columnas de la tabla. `key: null` = columna que no se ordena. */
  readonly columns: { key: EventSortKey | null; label: string }[] = [
    { key: 'name', label: 'Evento' },
    { key: 'date', label: 'Fecha y horario' },
    { key: 'type', label: 'Tipo' },
    { key: 'modality', label: 'Modalidad' },
    { key: 'credits', label: 'Créditos' },
    { key: null, label: 'Ubicación' },
    { key: 'capacity', label: 'Cupo' },
    { key: 'status', label: 'Estado' },
  ];

  readonly selectedStatus = signal<EventStatus | 'Todos'>('Todos');
  readonly selectedModality = signal<EventModality | 'Todas'>('Todas');
  readonly selectedType = signal<EventType | 'Todos'>('Todos');
  readonly search = signal('');

  /** Orden actual de la tabla: por defecto, los más recientes primero. */
  readonly sortKey = signal<EventSortKey>('date');
  readonly sortDir = signal<SortDirection>('desc');
  readonly pageSize = signal(3);

  /** Modal de exportación del listado filtrado. */
  readonly exportOpen = signal(false);
  readonly lastExport = signal<ExportResult | null>(null);

  /** Eventos que pasan los filtros de estado y búsqueda. */
  readonly events = computed(() =>
    this.eventService.filter({
      status: this.selectedStatus(),
      modality: this.selectedModality(),
      search: this.search(),
    })
  );

  /** Eventos filtrados por tipo y ordenados según la columna elegida. */
  readonly sortedEvents = computed(() => {
    const type = this.selectedType();
    const list =
      type === 'Todos' ? this.events() : this.events().filter((event) => event.eventType === type);
    const direction = this.sortDir() === 'asc' ? 1 : -1;
    const key = this.sortKey();
    return [...list].sort((a, b) => compareEvents(a, b, key) * direction);
  });

  /**
   * Página visible. Vuelve a 1 sola cuando cambia un filtro, el orden o el
   * tamaño de página, para no dejar a nadie mirando una página vacía.
   */
  readonly page = linkedSignal({
    source: () =>
      `${this.search()}|${this.selectedStatus()}|${this.selectedModality()}|${this.selectedType()}|${this.sortKey()}|${this.sortDir()}|${this.pageSize()}`,
    computation: () => 1,
  });

  readonly pageData = computed(() => {
    const items = this.sortedEvents();
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
    };
  });

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
  }

  openExport(): void {
    this.lastExport.set(null);
    this.exportOpen.set(true);
  }

  closeExport(): void {
    this.exportOpen.set(false);
  }

  exportEvents(): void {
    this.lastExport.set(this.exportService.downloadEventsList(this.sortedEvents()));
  }

  /** Clic en el encabezado: alterna dirección si ya era la columna activa. */
  sortBy(key: EventSortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set('asc');
  }

  isSortedBy(key: EventSortKey): boolean {
    return this.sortKey() === key;
  }

  onStatusChange(event: Event): void {
    this.selectedStatus.set(this.readValue(event) as EventStatus | 'Todos');
  }

  onModalityChange(event: Event): void {
    this.selectedModality.set(this.readValue(event) as EventModality | 'Todas');
  }

  onTypeChange(event: Event): void {
    this.selectedType.set(this.readValue(event) as EventType | 'Todos');
  }

  onSearch(event: Event): void {
    this.search.set(this.readValue(event));
  }

  formatRange(event: AcademicEvent): string {
    return formatDateTimeRange(event.startDate, event.endDate);
  }

  participantsCount(event: AcademicEvent): number {
    return this.participationService.countForEvent(event.id, true);
  }

  fillRate(event: AcademicEvent): number {
    if (!event.capacity) {
      return 0;
    }
    return Math.min(100, Math.round((this.participantsCount(event) / event.capacity) * 100));
  }

  private readValue(event: Event): string {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement
      ? event.target.value
      : '';
  }
}
