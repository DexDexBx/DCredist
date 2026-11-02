/**
 * CATALOGOS DE APOYO.
 *
 * Listas mantenidas por la institucion que alimentan los formularios: quien
 * organiza un evento, a que escuela profesional pertenece un estudiante y en
 * que sede estudia. Son tablas reales del backend: la interfaz nunca inventa
 * entradas y siempre trabaja con el id del catalogo.
 */
export type CatalogStatus = 'ACTIVE' | 'INACTIVE';

export type CatalogKind = 'organizers' | 'professionalSchools' | 'locations';

export interface CatalogEntry {
  /** Id incremental de la tabla del catalogo. */
  id: number;
  name: string;
  /** Inactivo: deja de ofrecerse en los formularios, pero conserva el historico. */
  status: CatalogStatus;
  /** Usuarios, estudiantes o eventos que referencian la entrada. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogDefinition {
  kind: CatalogKind;
  /** Segmento de URL de la pantalla del catalogo. */
  slug: string;
  label: string;
  singular: string;
  description: string;
  /** Donde se usa este catalogo. */
  usedIn: string;
}

export const CATALOGS: readonly CatalogDefinition[] = [
  {
    kind: 'organizers',
    slug: 'organizers',
    label: 'Organizadores',
    singular: 'organizador',
    description: 'Áreas y dependencias que organizan eventos académicos.',
    usedIn: 'Formulario de eventos',
  },
  {
    kind: 'professionalSchools',
    slug: 'professional-schools',
    label: 'Escuelas profesionales',
    singular: 'escuela profesional',
    description: 'Escuelas profesionales a las que pertenecen estudiantes, usuarios y eventos.',
    usedIn: 'Padrón, eventos y usuarios',
  },
  {
    kind: 'locations',
    slug: 'locations',
    label: 'Sedes',
    singular: 'sede',
    description: 'Sedes y filiales donde estudian los estudiantes.',
    usedIn: 'Padrón y formulario de estudiantes',
  },
];

/** Acepta el `kind` interno o el slug de la ruta (`professional-schools`). */
export function findCatalog(kindOrSlug: string): CatalogDefinition | null {
  return CATALOGS.find(
    (catalog) => catalog.kind === kindOrSlug || catalog.slug === kindOrSlug,
  ) ?? null;
}

export const CATALOG_STATUS_LABEL: Record<CatalogStatus, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
};

/** Opcion minima para un selector: id del catalogo + nombre visible. */
export interface CatalogOption {
  id: number;
  name: string;
}
