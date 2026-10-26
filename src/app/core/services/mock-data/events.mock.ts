import { AcademicEvent, EventModality, EventStatus, EventType } from '../../../models';

/**
 * MOCK DATA - EVENTOS ACADÉMICOS.
 *
 * Incluye eventos de un día y de varios días, con créditos por evento y un
 * evento cancelado para poder probar la validación que bloquea nuevas
 * participaciones en eventos cancelados.
 */

const HOUR_MS = 3_600_000;

function at(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const shifted = new Date(date.getTime() + dayOffset * 86_400_000);
  shifted.setHours(hour, minute, 0, 0);
  return shifted;
}

interface EventSeed {
  id: string;
  code: string;
  name: string;
  description: string;
  eventType: EventType;
  /** Offset en días respecto de hoy, a las startHour. */
  startOffset: number;
  startHour: number;
  /** Duración expresada en horas. Menos de 24h = evento de un día. */
  durationHours: number;
  modality: EventModality;
  location: string;
  status: EventStatus;
  capacity: number | null;
  organizer: string;
  credits: number;
  tags: string[];
}

const EVENT_SEEDS: EventSeed[] = [
  {
    id: 'evt-001',
    code: 'EVT-2026-001',
    name: 'Congreso Internacional de Educación Superior',
    description:
      'Encuentro académico sobre innovación curricular, evaluación y transformación digital en la educación superior.',
    eventType: 'Congreso',
    startOffset: -18,
    startHour: 8,
    durationHours: 9,
    modality: 'Presencial',
    location: 'Auditorio Central, Campus Norte',
    status: 'Finalizado',
    capacity: 400,
    organizer: 'Vicerrectoría Académica',
    credits: 2,
    tags: ['Congreso', 'Internacional'],
  },
  {
    id: 'evt-002',
    code: 'EVT-2026-002',
    name: 'Seminario de Investigación Científica',
    description:
      'Presentación de líneas de investigación, metodologías emergentes y resultados de proyectos en curso.',
    eventType: 'Seminario',
    startOffset: -9,
    startHour: 9,
    durationHours: 7,
    modality: 'Híbrido',
    location: 'Aula Magna 201 y transmisión en vivo',
    status: 'Finalizado',
    capacity: 180,
    organizer: 'Dirección de Investigación',
    credits: 1.5,
    tags: ['Seminario', 'Investigación'],
  },
  {
    id: 'evt-003',
    code: 'EVT-2026-003',
    name: 'Taller de Integridad Académica',
    description:
      'Jornada de actualización sobre plagio, citación, ética en la investigación y buenas prácticas académicas.',
    eventType: 'Taller',
    startOffset: -3,
    startHour: 14,
    durationHours: 4,
    modality: 'Virtual',
    location: 'Plataforma institucional',
    status: 'Finalizado',
    capacity: null,
    organizer: 'Comité de Ética Académica',
    credits: 1,
    tags: ['Ética', 'Capacitación'],
  },
  {
    id: 'evt-004',
    code: 'EVT-2026-004',
    name: 'Foro de Innovación Docente',
    description:
      'Paneles de experiencia docente sobre nuevas herramientas, evaluación por competencias y diseño instruccional.',
    eventType: 'Foro',
    // Evento de varios días: 30 horas de duración.
    startOffset: 0,
    startHour: 9,
    durationHours: 30,
    modality: 'Presencial',
    location: 'Centro de Convenciones, Pabellón B',
    status: 'En curso',
    capacity: 250,
    organizer: 'Dirección Académica',
    credits: 2,
    tags: ['Foro', 'Docencia'],
  },
  {
    id: 'evt-005',
    code: 'EVT-2026-005',
    name: 'Encuentro de Salud Estudiantil',
    description:
      'Charlas de prevención, bienestar mental y acompañamiento integral para la comunidad estudiantil.',
    eventType: 'Conferencia',
    startOffset: 2,
    startHour: 10,
    durationHours: 6,
    modality: 'Presencial',
    location: 'Pabellón de Servicios, Planta 1',
    status: 'Programado',
    capacity: 300,
    organizer: 'Bienestar Estudiantil',
    credits: 1,
    tags: ['Bienestar'],
  },
  {
    id: 'evt-006',
    code: 'EVT-2026-006',
    name: 'Webinar: Novedades de las Carreras Técnicas',
    description:
      'Sesión informativa sobre nuevos programas, potencial de empleabilidad y rutas de certificación.',
    eventType: 'Webinar',
    startOffset: 5,
    startHour: 17,
    durationHours: 3,
    modality: 'Virtual',
    location: 'Plataforma institucional',
    status: 'Programado',
    capacity: null,
    organizer: 'Facultad de Ingeniería',
    credits: 1,
    tags: ['Webinar', 'Carreras'],
  },
  {
    id: 'evt-007',
    code: 'EVT-2026-007',
    name: 'Curso de Actualización en Metodologías',
    description:
      'Programa de actualización docente en aprendizaje basado en proyectos y evaluación por competencias.',
    eventType: 'Curso',
    // Evento de varios días: 54 horas de duración.
    startOffset: 9,
    startHour: 8,
    durationHours: 54,
    modality: 'Híbrido',
    location: 'Aulas 104 a 106 y streaming',
    status: 'Programado',
    capacity: 120,
    organizer: 'Centro de Desarrollo Docente',
    credits: 3,
    tags: ['Curso', 'Actualización'],
  },
  {
    id: 'evt-008',
    code: 'EVT-2026-008',
    name: 'Muestra de Proyectos Estudiantiles',
    description:
      'Presentación de proyectos finales de carreras técnicas y exposición de prototipos.',
    eventType: 'Muestra',
    startOffset: 16,
    startHour: 11,
    durationHours: 5,
    modality: 'Presencial',
    location: 'Explanada Central',
    status: 'Programado',
    capacity: 500,
    organizer: 'Dirección Académica',
    credits: 1.5,
    tags: ['Muestra', 'Proyectos'],
  },
  {
    id: 'evt-009',
    code: 'EVT-2026-009',
    name: 'Cine Universitario',
    description: 'Evento cancelado por motivos de seguridad institucional.',
    eventType: 'Conferencia',
    startOffset: 23,
    startHour: 19,
    durationHours: 3,
    modality: 'Presencial',
    location: 'Teatro Universitario',
    status: 'Cancelado',
    capacity: 150,
    organizer: 'Cultura Universitaria',
    credits: 1,
    tags: ['Cultura'],
  },
];

function toEvent(seed: EventSeed): AcademicEvent {
  const start = at(seed.startOffset, seed.startHour);
  const end = new Date(start.getTime() + seed.durationHours * HOUR_MS);

  return {
    id: seed.id,
    code: seed.code,
    name: seed.name,
    description: seed.description,
    eventType: seed.eventType,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    modality: seed.modality,
    location: seed.location,
    status: seed.status,
    capacity: seed.capacity,
    organizer: seed.organizer,
    credits: seed.credits,
    tags: seed.tags,
  };
}

/**
 * PERIODOS HISTORICOS.
 *
 * Sin ellos el calendario solo muestra la semana en curso y el máximo de
 * créditos que un estudiante puede acumular son 14: nadie alcanzaría la meta de
 * 21 y el corte de acreditación sería siempre cero. Un padrón histórico exige
 * también un historial de eventos.
 */
const HISTORICAL_YEARS = [2025, 2024, 2023];

const HISTORICAL_NAMES: [EventType, string, string, number][] = [
  ['Congreso', 'Congreso de Investigación Científica', 'Presentación de resultados de investigación de las diferentes escuelas profesionales.', 3],
  ['Seminario', 'Seminario de Actualización Curricular', 'Revisión de contenidos y metodologías de los programas de estudio.', 2],
  ['Taller', 'Taller de Ludopatía y Salud Mental', 'Prevención y detección temprana de trastornos de juego y salud mental.', 1.5],
  ['Curso', 'Curso de Formación Docente', 'Programa de actualización para docentes en evaluación por competencias.', 3],
  ['Conferencia', 'Conferencia de presentación de proyectos', 'Presentación de resultados de proyectos de investigación y tesis.', 2],
  ['Webinar', 'Webinar de Inclusión y Accesibilidad', 'Lineamientos de inclusión y accesibilidad en la educación superior.', 1],
  ['Foro', 'Foro de empleabilidad profesional', 'Paneles sobre inserción laboral y perfiles de egreso.', 1.5],
  ['Muestra', 'Muestra de Proyectos Fin de Carrera', 'Exposición de prototipos y proyectos finales.', 2],
];

const HISTORICAL_ORGANIZERS = [
  'Dirección Académica',
  'Dirección de Investigación',
  'Vicerrectoría Académica',
  'Bienestar Estudiantil',
];

function buildHistoricalEvents(): AcademicEvent[] {
  const events: AcademicEvent[] = [];

  HISTORICAL_YEARS.forEach((year, yearIndex) => {
    HISTORICAL_NAMES.forEach(([eventType, name, description, credits], nameIndex) => {
      // Entre 3 y 5 eventos por año, repartidos a lo largo del año.
      const offsetInYear = -420 + yearIndex * 365 + nameIndex * 82;

      events.push(
        toEvent({
          id: `evt-h${year}-${nameIndex + 1}`,
          code: `EVT-${year}-${String(nameIndex + 1).padStart(3, '0')}`,
          name,
          description,
          eventType,
          startOffset: offsetInYear,
          startHour: 9,
          durationHours: 8,
          modality: nameIndex % 3 === 0 ? 'Virtual' : nameIndex % 3 === 1 ? 'Presencial' : 'Híbrido',
          location: nameIndex % 3 === 0 ? 'Plataforma institucional' : 'Auditorio Central, Campus Norte',
          status: 'Finalizado',
          capacity: nameIndex % 4 === 0 ? null : 150 + nameIndex * 25,
          organizer: HISTORICAL_ORGANIZERS[nameIndex % HISTORICAL_ORGANIZERS.length],
          credits,
          tags: [eventType, String(year)],
        })
      );
    });
  });

  return events;
}

export function buildMockEvents(): AcademicEvent[] {
  return [...EVENT_SEEDS.map(toEvent), ...buildHistoricalEvents()];
}
