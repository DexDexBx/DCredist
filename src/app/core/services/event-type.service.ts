import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CatalogStatus } from '../../models/catalog.model';
import { eventTypeLabel } from '../../models/academic-event.model';
import { DcreditsApiClient } from '../api/dcredits-api.client';

/** Tipo de evento listo para los selectores de la interfaz. */
export interface EventTypeOption {
  id: number;
  /** Nombre guardado en la base (en ingles). */
  name: string;
  /** Nombre visible en espanol. */
  label: string;
  status: CatalogStatus;
}

/**
 * TIPOS DE EVENTO.
 *
 * Catalogo de solo lectura que alimenta el formulario de eventos. La base
 * guarda los nombres en ingles y aqui se traducen para mostrarlos en espanol.
 *
 * Mientras el API no responde se usan los ocho tipos iniciales: los ids
 * coinciden con el orden en que los crea la migracion.
 */
@Injectable({ providedIn: 'root' })
export class EventTypeService {
  private readonly api = inject(DcreditsApiClient);

  private readonly state = signal<EventTypeOption[]>(defaultEventTypes());
  private loaded = false;

  readonly types = this.state.asReadonly();

  readonly activeTypes = computed(() =>
    this.state().filter((type) => type.status === 'ACTIVE'),
  );

  /** Carga el catalogo. Idempotente: se pide una sola vez por sesion. */
  async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const rows = await firstValueFrom(this.api.listEventTypes());
      this.state.set(
        rows.map((row) => ({
          id: row.id,
          name: row.name,
          label: eventTypeLabel(row.name),
          status: row.status as CatalogStatus,
        })),
      );
      this.loaded = true;
    } catch {
      // Sin API se conservan los tipos iniciales.
    }
  }

  /** Nombre en espanol del tipo, o vacio si el id no existe. */
  labelOf(id: number | null | undefined): string {
    if (!id) {
      return '';
    }
    return this.state().find((type) => type.id === id)?.label ?? '';
  }

  /** Nombre guardado en la base (en ingles), o vacio si el id no existe. */
  nameOf(id: number | null | undefined): string {
    if (!id) {
      return '';
    }
    return this.state().find((type) => type.id === id)?.name ?? '';
  }
}

function defaultEventTypes(): EventTypeOption[] {
  return [
    'Congress',
    'Seminar',
    'Workshop',
    'Course',
    'Forum',
    'Conference',
    'Webinar',
    'Exhibition',
    'Unspecified',
  ].map((name, index) => ({
    id: index + 1,
    name,
    label: eventTypeLabel(name),
    status: 'ACTIVE' as CatalogStatus,
  }));
}
