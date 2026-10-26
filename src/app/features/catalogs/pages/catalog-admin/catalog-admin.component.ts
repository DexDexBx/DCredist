import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import {
  CATALOGS,
  CatalogDefinition,
  CatalogEntry,
  CatalogKind,
  findCatalog,
} from '../../../../models/catalog.model';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
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
 * pestaña activa sale de la ruta `/catalogs/:kind`. Renombrar propaga el
 * nombre al historico y las entradas en uso no se pueden borrar (se
 * desactivan), de modo que eventos y estudiantes nunca queden huérfanos.
 */
@Component({
  selector: 'app-catalog-admin',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    PageHeaderComponent,
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

  readonly auth = inject(AuthService);

  /** Nombre del catalogo tomado de la ruta /catalogs/:kind. */
  readonly kind = input<string>('organizers', { alias: 'kind' });

  readonly catalogs = CATALOGS;

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

  /** Cantidad de entradas de otro catalogo (para las pestanas). */
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
      .map((entry) => ({
        entry,
        usage: this.catalogService.usageCount(kind, entry.name),
      }));
  });

  readonly newName = signal('');
  readonly newNameError = signal<string | null>(null);

  readonly editingId = signal<string | null>(null);
  readonly editingName = signal('');
  readonly editError = signal<string | null>(null);

  readonly pendingDeleteId = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!findCatalog(this.kind())) {
        void this.router.navigate(['/catalogs', CATALOGS[0].kind], { replaceUrl: true });
      }
    });
  }

  /** Unidad del historico que usa el catalogo, para los textos de uso. */
  unit(): string {
    return this.definition().kind === 'organizers' ? 'evento' : 'estudiante';
  }

  addEntry(): void {
    this.newNameError.set(null);

    if (!this.canManage()) {
      return;
    }

    const name = this.newName().trim();
    if (!name) {
      this.newNameError.set('Escribe un nombre antes de agregar.');
      return;
    }

    if (!this.catalogService.create(this.definition().kind, name)) {
      this.newNameError.set('Ya existe una entrada con ese nombre.');
      return;
    }

    this.newName.set('');
  }

  startEdit(entry: CatalogEntry): void {
    this.pendingDeleteId.set(null);
    this.editError.set(null);
    this.editingId.set(entry.id);
    this.editingName.set(entry.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
    this.editError.set(null);
  }

  saveEdit(): void {
    const id = this.editingId();
    if (!id || !this.canManage()) {
      return;
    }

    this.editError.set(null);
    const name = this.editingName().trim();
    if (!name) {
      this.editError.set('El nombre no puede quedar vacío.');
      return;
    }

    if (!this.catalogService.rename(this.definition().kind, id, name)) {
      this.editError.set('Ese nombre ya está registrado en el catálogo.');
      return;
    }

    this.cancelEdit();
  }

  toggleActive(entry: CatalogEntry): void {
    if (!this.canManage()) {
      return;
    }

    this.catalogService.setActive(this.definition().kind, entry.id, !entry.active);
  }

  requestDelete(entry: CatalogEntry, usage: number): void {
    if (!this.canManage() || usage > 0) {
      return;
    }

    this.cancelEdit();
    this.pendingDeleteId.set(entry.id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(id: string): void {
    if (!this.canManage()) {
      return;
    }

    this.catalogService.remove(this.definition().kind, id);
    this.pendingDeleteId.set(null);
  }
}
