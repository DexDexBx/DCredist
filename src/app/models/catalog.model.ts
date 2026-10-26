/**
 * CATALOGOS DE APOYO.
 *
 * Listas mantenidas por la institucion que alimentan los formularios: quien
 * organiza un evento, a que escuela profesional pertenece un estudiante y en
 * que sede estudia. Se mantienen aparte del evento y del estudiante para no
 * repetir el texto libre y poder corregirlo en un solo lugar.
 */
export type CatalogKind = 'organizers' | 'schools' | 'headquarters';

export interface CatalogEntry {
  id: string;
  /** Texto visible y valor que se guarda en eventos y estudiantes. */
  name: string;
  /** Inactivo: deja de ofrecerse en los formularios, pero conserva el historico. */
  active: boolean;
  createdAt: string;
}

export interface CatalogDefinition {
  kind: CatalogKind;
  label: string;
  singular: string;
  description: string;
  /** Donde se usa este catalogo. */
  usedIn: string;
}

export const CATALOGS: readonly CatalogDefinition[] = [
  {
    kind: 'organizers',
    label: 'Organizadores',
    singular: 'organizador',
    description: 'Áreas y dependencias que organizan eventos académicos.',
    usedIn: 'Formulario de eventos',
  },
  {
    kind: 'schools',
    label: 'Escuelas profesionales',
    singular: 'escuela profesional',
    description: 'Escuelas profesionales a las que pertenecen los estudiantes.',
    usedIn: 'Padrón y formulario de estudiantes',
  },
  {
    kind: 'headquarters',
    label: 'Sedes',
    singular: 'sede',
    description: 'Sedes y filiales donde se dictan las actividades.',
    usedIn: 'Padrón y formulario de estudiantes',
  },
];

export function findCatalog(kind: string): CatalogDefinition | null {
  return CATALOGS.find((catalog) => catalog.kind === kind) ?? null;
}
