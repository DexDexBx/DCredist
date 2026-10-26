import { Injectable, computed, inject, signal } from '@angular/core';

import { CatalogEntry, CatalogKind } from '../../models/catalog.model';
import { buildMockCatalogs } from './mock-data/catalogs.mock';
import { EventService } from './event.service';
import { StudentService } from './student.service';

/**
 * CATALOGOS.
 *
 * Mantiene las listas de apoyo (organizadores, escuelas y sedes) y las
 * relaciona con el historico. Como todavia no hay API, todo vive en memoria:
 * al recargar la pagina vuelven las semillas de `buildMockCatalogs`.
 *
 * Renombrar una entrada propaga el nombre a eventos y estudiantes para no
 * dejar registros apuntando a un valor que ya no existe. Borrar solo se
 * permite cuando no hay registros que lo usen; si hay historico, se desactiva.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);

  private readonly state = signal<Record<CatalogKind, CatalogEntry[]>>(buildMockCatalogs());
  private sequence = 0;

  readonly catalogs = this.state.asReadonly();

  /** Cuantas veces se usa cada nombre en eventos y en el padron. */
  readonly usage = computed<Record<CatalogKind, Map<string, number>>>(() => {
    const organizers = new Map<string, number>();
    for (const event of this.eventService.events()) {
      const organizer = event.organizer;
      if (!organizer) {
        continue;
      }
      organizers.set(organizer, (organizers.get(organizer) ?? 0) + 1);
    }

    return {
      organizers,
      schools: this.studentService.countBySchool(),
      headquarters: this.studentService.countByHeadquarters(),
    };
  });

  entries(kind: CatalogKind): CatalogEntry[] {
    return this.state()[kind];
  }

  activeEntries(kind: CatalogKind): CatalogEntry[] {
    return this.state()[kind].filter((entry) => entry.active);
  }

  /** Nombres activos, en el orden en que se ofrecen en los formularios. */
  names(kind: CatalogKind): string[] {
    return this.activeEntries(kind).map((entry) => entry.name);
  }

  usageCount(kind: CatalogKind, name: string): number {
    return this.usage()[kind].get(name) ?? 0;
  }

  exists(kind: CatalogKind, name: string, ignoreId?: string): boolean {
    const key = name.trim().toUpperCase();
    return this.state()[kind].some(
      (entry) => entry.id !== ignoreId && entry.name.trim().toUpperCase() === key,
    );
  }

  create(kind: CatalogKind, name: string): CatalogEntry | null {
    const trimmed = this.normalizeName(kind, name);
    if (!trimmed || this.exists(kind, trimmed)) {
      return null;
    }

    const entry: CatalogEntry = {
      id: `cat-${kind}-n${++this.sequence}`,
      name: trimmed,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.state.update((current) => ({
      ...current,
      [kind]: [...current[kind], entry],
    }));

    return entry;
  }

  rename(kind: CatalogKind, id: string, name: string): boolean {
    const trimmed = this.normalizeName(kind, name);
    const entry = this.state()[kind].find((item) => item.id === id);

    if (!entry || !trimmed || this.exists(kind, trimmed, id)) {
      return false;
    }

    if (entry.name === trimmed) {
      return true;
    }

    const previous = entry.name;
    this.state.update((current) => ({
      ...current,
      [kind]: current[kind].map((item) =>
        item.id === id ? { ...item, name: trimmed } : item,
      ),
    }));
    this.propagate(kind, previous, trimmed);

    return true;
  }

  setActive(kind: CatalogKind, id: string, active: boolean): void {
    this.state.update((current) => ({
      ...current,
      [kind]: current[kind].map((item) => (item.id === id ? { ...item, active } : item)),
    }));
  }

  /** Borra solo si no hay eventos ni estudiantes que lo usen. */
  remove(kind: CatalogKind, id: string): boolean {
    const entry = this.state()[kind].find((item) => item.id === id);
    if (!entry || this.usageCount(kind, entry.name) > 0) {
      return false;
    }

    this.state.update((current) => ({
      ...current,
      [kind]: current[kind].filter((item) => item.id !== id),
    }));

    return true;
  }

  /**
   * El padron guarda escuelas y sedes en mayusculas; el catalogo usa el mismo
   * formato para que el conteo de uso y el renombrado coincidan.
   */
  private normalizeName(kind: CatalogKind, name: string): string {
    const trimmed = name.trim();
    return kind === 'organizers' ? trimmed : trimmed.toUpperCase();
  }

  private propagate(kind: CatalogKind, previous: string, next: string): void {    switch (kind) {
      case 'organizers':
        this.eventService.renameOrganizer(previous, next);
        break;
      case 'schools':
        this.studentService.renameProfessionalSchool(previous, next);
        break;
      case 'headquarters':
        this.studentService.renameHeadquarters(previous, next);
        break;
    }
  }
}
