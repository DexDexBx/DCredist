import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ApiHydrationService } from '../../../../core/services/api-hydration.service';
import {
  CATALOGS,
  CATALOG_STATUS_LABEL,
  CatalogDefinition,
  CatalogEntry,
  CatalogKind,
  findCatalog,
} from '../../../../models/catalog.model';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { LoadingStateComponent } from '../../../../shared/components/ui/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { formatMediumDate } from '../../../../shared/utils/date.utils';

interface CatalogRow {
  entry: CatalogEntry;
  usage: number;
}

/**
 * MANTENIMIENTO DE CATALOGOS.
 *
 * Una sola pantalla para organizadores, escuelas profesionales y sedes; la
 * pestaña activa sale de la ruta `/catalogs/:kind` (kind interno o slug).
 *
 * Las entradas son tablas reales del backend: crear, renombrar y cambiar el
 * estado se ejecutan contra el API. Una entrada en uso no se elimina (se
 * desactiva), de modo que eventos y estudiantes nunca queden huérfanos.
 */
@Component({
  selector: 'app-catalog-admin',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    LoadingStateComponent,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    RouterLink,
    RouterLinkActive,
    StatCardComponent,
  ],
  templateUrl: './catalog-admin.component.html',
})
export class CatalogAdminComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly hydration = inject(ApiHydrationService);

  readonly auth = inject(AuthService);

  /** true mientras los catalogos se esten cargando del API. */
  readonly loading = computed(() => this.hydration.loadingReference());

  /** Nombre del catalogo tomado de la ruta /catalogs/:kind. */
  readonly kind = input<string>('organizers', { alias: 'kind' });

  readonly catalogs = CATALOGS;
  readonly statusLabel = CATALOG_STATUS_LABEL;

  readonly definition = computed<CatalogDefinition>(
    () => findCatalog(this.kind()) ?? CATALOGS[0],
  );

  readonly canManage = computed(() => this.auth.can('catalogs', 'MANAGE'));

  readonly searchInput = signal('');

  readonly total = computed(() => this.catalogService.entries(this.definition().kind).length);

  readonly activeCount = computed(
    () => this.catalogService.activeEntries(this.definition().kind).length,
  );

  /** Entradas del catalogo que ya aparecen en eventos o estudiantes. */
  readonly inUseCount = computed(() => this.rows().filter((row) => row.usage > 0).length);

  /** Cantidad de entradas de otro catalogo (para las pestañas). */
  countOf(kind: CatalogKind): number {
    return this.catalogService.entries(kind).length;
  }

  createdAtLabel(iso: string): string {
    return formatMediumDate(iso);
  }

  readonly rows = computed<CatalogRow[]>(() => {
    const kind = this.definition().kind;
    const term = this.searchInput().trim().toLowerCase();

    return this.catalogService
      .entries(kind)
      .filter((entry) => !term || entry.name.toLowerCase().includes(term))
      .map((entry) => ({ entry, usage: entry.usageCount }));
  });

  readonly pageSize = signal(15);

  /** Al cambiar de catalogo, busqueda o tamano de pagina se vuelve a la 1. */
  readonly page = linkedSignal({
    source: () => `${this.definition().kind}|${this.searchInput()}|${this.pageSize()}`,
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
    };
  });

  readonly newName = signal('');
  readonly newNameError = signal<string | null>(null);

  readonly editingId = signal<number | null>(null);
  readonly editingName = signal('');
  readonly editError = signal<string | null>(null);

  readonly pendingDeleteId = signal<number | null>(null);

  /** Mensaje de la ultima operacion (registro en uso, error del API, etc.). */
  readonly mutationError = signal<string | null>(null);

  /** La entrada cuyo cambio de estado esta en curso. */
  readonly busyId = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (!findCatalog(this.kind())) {
        void this.router.navigate(['/catalogs', CATALOGS[0].slug], { replaceUrl: true });
      }
    });

    // Al cambiar de pestaña se descarta la edicion en curso: los ids pertenecen
    // a otra tabla.
    effect(() => {
      this.definition().kind;
      this.editingId.set(null);
      this.editingName.set('');
      this.editError.set(null);
      this.pendingDeleteId.set(null);
      this.mutationError.set(null);
      this.newNameError.set(null);
    });
  }

  /** Unidad del historico que usa el catalogo, para los textos de uso. */
  unit(): string {
    switch (this.definition().kind) {
      case 'organizers':
        return 'evento';
      case 'locations':
        return 'estudiante';
      default:
        return 'registro';
    }
  }

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
  }

  async addEntry(): Promise<void> {
    this.newNameError.set(null);
    this.mutationError.set(null);

    if (!this.canManage()) {
      return;
    }

    const name = this.newName().trim();
    if (!name) {
      this.newNameError.set('Escribe un nombre antes de agregar.');
      return;
    }

    const result = await this.catalogService.create(this.definition().kind, name);
    if (!result.ok) {
      this.newNameError.set(result.message ?? 'No se pudo agregar la entrada.');
      return;
    }

    this.newName.set('');
  }

  startEdit(entry: CatalogEntry): void {
    this.pendingDeleteId.set(null);
    this.mutationError.set(null);
    this.editError.set(null);
    this.editingId.set(entry.id);
    this.editingName.set(entry.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editError.set(null);
  }

  async saveEdit(): Promise<void> {
    const id = this.editingId();
    if (id === null || !this.canManage()) {
      return;
    }

    this.editError.set(null);
    const name = this.editingName().trim();
    if (!name) {
      this.editError.set('El nombre no puede quedar vacío.');
      return;
    }

    const result = await this.catalogService.rename(this.definition().kind, id, name);
    if (!result.ok) {
      this.editError.set(result.message ?? 'No se pudo renombrar la entrada.');
      return;
    }

    this.cancelEdit();
  }

  async toggleActive(entry: CatalogEntry): Promise<void> {
    if (!this.canManage()) {
      return;
    }

    this.mutationError.set(null);
    this.busyId.set(entry.id);

    const result = await this.catalogService.setStatus(
      this.definition().kind,
      entry.id,
      entry.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    );

    this.busyId.set(null);

    if (!result.ok) {
      this.mutationError.set(result.message ?? 'No se pudo cambiar el estado.');
    }
  }

  requestDelete(entry: CatalogEntry, usage: number): void {
    if (!this.canManage() || usage > 0) {
      return;
    }

    this.cancelEdit();
    this.mutationError.set(null);
    this.pendingDeleteId.set(entry.id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  async confirmDelete(id: number): Promise<void> {
    if (!this.canManage()) {
      return;
    }

    this.mutationError.set(null);
    this.busyId.set(id);

    const result = await this.catalogService.remove(this.definition().kind, id);

    this.busyId.set(null);
    this.pendingDeleteId.set(null);

    if (!result.ok) {
      this.mutationError.set(result.message ?? 'No se pudo eliminar la entrada.');
    }
  }
}
