import { CatalogEntry, CatalogKind } from '../../../models/catalog.model';
import { HEADQUARTERS, PROFESSIONAL_SCHOOLS } from './students.mock';

/**
 * Catalogos de demostracion.
 *
 * Las semillas salen de los datos mock ya existentes (organizadores de los
 * eventos, escuelas y sedes del padron) para que ningun formulario ofrezca una
 * opcion que no aparezca en el historico. Son datos mock: no hay backend.
 */
const ORGANIZER_SEEDS = [
  'Vicerrectoría Académica',
  'Dirección de Investigación',
  'Comité de Ética Académica',
  'Dirección Académica',
  'Bienestar Estudiantil',
  'Facultad de Ingeniería',
  'Centro de Desarrollo Docente',
  'Cultura Universitaria',
];

function toEntries(prefix: string, names: readonly string[]): CatalogEntry[] {
  const seen = new Set<string>();

  return names
    .filter((name) => name.trim().length > 0)
    .filter((name) => {
      const key = name.trim().toUpperCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((name, index) => ({
      id: `${prefix}-${index + 1}`,
      name: name.trim(),
      active: true,
      createdAt: new Date(2026, 0, index + 1).toISOString(),
    }));
}

export function buildMockCatalogs(): Record<CatalogKind, CatalogEntry[]> {
  return {
    organizers: toEntries('cat-organizer', ORGANIZER_SEEDS),
    schools: toEntries('cat-school', PROFESSIONAL_SCHOOLS),
    headquarters: toEntries('cat-headquarters', HEADQUARTERS),
  };
}
