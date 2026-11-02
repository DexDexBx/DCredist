import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  CATALOGS,
  CatalogEntry,
  CatalogKind,
  CatalogOption,
  CatalogStatus,
} from '../../models/catalog.model';
import { mapApiCatalogEntry } from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';

/** Resultado de una operacion de mantenimiento del catalogo. */
export interface CatalogMutationResult {
  ok: boolean;
  entry?: CatalogEntry;
  /** Mensaje legible del API (nombre repetido, registro en uso, etc.). */
  message?: string;
}

/**
 * CATALOGOS.
 *
 * Escuelas profesionales, sedes y organizadores son tablas del backend. Este
 * servicio es la unica puerta de la interfaz hacia ellas: carga las entradas al
 * arrancar y expone el CRUD.
 *
 * La escuela `general` es del sistema (cuentas globales). El API la oculta por
 * defecto; cuando llega, este servicio la mantiene fuera de los listados y solo
 * la ofrece en el formulario de usuarios.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(DcreditsApiClient);

  private readonly state = signal<Record<CatalogKind, CatalogEntry[]>>(emptyCatalogs());

  readonly catalogs = this.state.asReadonly();

  /** true cuando ya se intento cargar el catalogo desde el API. */
  readonly loaded = signal(false);

  /** Escuela del sistema, si el usuario global la recibio del API. */
  readonly generalSchool = computed<CatalogOption | null>(() => {
    const entry = this.state().professionalSchools.find(
      (item) => item.name.trim().toLowerCase() === 'general',
    );
    return entry ? { id: entry.id, name: entry.name } : null;
  });

  // --- Lectura ---------------------------------------------------------------

  /** Entradas visibles del catalogo: `general` nunca se muestra como escuela. */
  entries(kind: CatalogKind): CatalogEntry[] {
    return this.state()[kind].filter((entry) => this.isVisible(kind, entry));
  }

  activeEntries(kind: CatalogKind): CatalogEntry[] {
    return this.entries(kind).filter((entry) => entry.status === 'ACTIVE');
  }

  /** Nombres activos, en el orden en que se ofrecen en los formularios. */
  names(kind: CatalogKind): string[] {
    return this.activeEntries(kind).map((entry) => entry.name);
  }

  /** Opciones id + nombre para los selectores. */
  options(kind: CatalogKind, includeGeneral = false): CatalogOption[] {
    if (kind === 'professionalSchools' && includeGeneral) {
      return this.state()
        .professionalSchools.filter((entry) => entry.status === 'ACTIVE')
        .map((entry) => ({ id: entry.id, name: entry.name }));
    }

    return this.activeEntries(kind).map((entry) => ({ id: entry.id, name: entry.name }));
  }

  findById(kind: CatalogKind, id: number): CatalogEntry | undefined {
    return this.state()[kind].find((entry) => entry.id === id);
  }

  nameOf(kind: CatalogKind, id: number): string {
    return this.findById(kind, id)?.name ?? '';
  }

  usageCount(kind: CatalogKind, id: number): number {
    return this.findById(kind, id)?.usageCount ?? 0;
  }

  // --- Carga ----------------------------------------------------------------

  /** Carga un catalogo desde el API. Devuelve false si el API no responde. */
  async load(kind: CatalogKind, options: { includeGeneral?: boolean } = {}): Promise<boolean> {
    try {
      const rows = await firstValueFrom(
        this.api.listCatalog(kind, { includeGeneral: options.includeGeneral }),
      );
      this.state.update((current) => ({
        ...current,
        [kind]: rows.map(mapApiCatalogEntry),
      }));
      return true;
    } catch {
      return false;
    }
  }

  /** Carga los tres catalogos. La hidratacion la usa al arrancar. */
  async loadAll(): Promise<void> {
    await Promise.all(
      CATALOGS.map((definition) =>
        this.load(definition.kind, {
          // `general` solo la recibe un actor global: se pide siempre para que
          // el formulario de usuarios pueda ofrecerla y para resolver su id.
          includeGeneral: definition.kind === 'professionalSchools',
        }),
      ),
    );
    this.loaded.set(true);
  }

  // --- Mantenimiento --------------------------------------------------------

  async create(kind: CatalogKind, name: string): Promise<CatalogMutationResult> {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, message: 'Escribe un nombre antes de agregar.' };
    }

    if (this.existsByName(kind, trimmed)) {
      return { ok: false, message: 'Ya existe una entrada con ese nombre.' };
    }

    try {
      const row = await firstValueFrom(
        this.api.createCatalogEntry(kind, { name: trimmed })
      );
      const entry = mapApiCatalogEntry(row);
      this.state.update((current) => ({ ...current, [kind]: [...current[kind], entry] }));
      return { ok: true, entry };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'No se pudo crear la entrada.') };
    }
  }

  async rename(kind: CatalogKind, id: number, name: string): Promise<CatalogMutationResult> {
    const trimmed = name.trim();

    if (!trimmed) {
      return { ok: false, message: 'El nombre no puede quedar vacío.' };
    }

    if (this.existsByName(kind, trimmed, id)) {
      return { ok: false, message: 'Ese nombre ya está registrado en el catálogo.' };
    }

    try {
      const row = await firstValueFrom(
        this.api.updateCatalogEntry(kind, id, { name: trimmed })
      );
      const entry = mapApiCatalogEntry(row);
      this.replaceEntry(kind, entry);
      return { ok: true, entry };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'No se pudo renombrar la entrada.') };
    }
  }

  async setStatus(
    kind: CatalogKind,
    id: number,
    status: CatalogStatus,
  ): Promise<CatalogMutationResult> {
    try {
      const row = await firstValueFrom(
        this.api.updateCatalogEntry(kind, id, { status })
      );
      const entry = mapApiCatalogEntry(row);
      this.replaceEntry(kind, entry);
      return { ok: true, entry };
    } catch (error) {
      return {
        ok: false,
        message: errorMessage(error, 'No se pudo cambiar el estado de la entrada.'),
      };
    }
  }

  async remove(kind: CatalogKind, id: number): Promise<CatalogMutationResult> {
    const entry = this.findById(kind, id);

    if (entry && entry.usageCount > 0) {
      return {
        ok: false,
        message: `No se puede eliminar "${entry.name}": tiene registros vinculados. Desactívala en su lugar.`,
      };
    }

    try {
      await firstValueFrom(this.api.deleteCatalogEntry(kind, id));
      this.state.update((current) => ({
        ...current,
        [kind]: current[kind].filter((item) => item.id !== id),
      }));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: errorMessage(error, 'No se pudo eliminar la entrada.') };
    }
  }

  // --- Apoyo ----------------------------------------------------------------

  private isVisible(kind: CatalogKind, entry: CatalogEntry): boolean {
    return kind !== 'professionalSchools' || entry.name.trim().toLowerCase() !== 'general';
  }

  private existsByName(kind: CatalogKind, name: string, ignoreId?: number): boolean {
    const key = name.trim().toLowerCase();
    return this.state()[kind].some(
      (entry) => entry.id !== ignoreId && entry.name.trim().toLowerCase() === key,
    );
  }

  private replaceEntry(kind: CatalogKind, entry: CatalogEntry): void {
    this.state.update((current) => ({
      ...current,
      [kind]: current[kind].map((item) => (item.id === entry.id ? entry : item)),
    }));
  }
}

function emptyCatalogs(): Record<CatalogKind, CatalogEntry[]> {
  return { organizers: [], professionalSchools: [], locations: [] };
}

/** Mensaje del API si lo trae; si no, uno generico para la interfaz. */
function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: unknown } | null;
    const message = body?.message;

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }

  return fallback;
}
