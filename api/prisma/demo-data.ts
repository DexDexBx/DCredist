import {
  CatalogStatus,
  EventModality,
  EventStatus,
  EventType,
  ParticipationStatus,
  ParticipationType,
  StudentStatus,
  type PrismaClient,
} from '../src/generated/prisma/client';

/**
 * DATOS ACADEMICOS DE DEMOSTRACION.
 *
 * Un unico origen para los seeds: `seed.ts` (datos minimos) y `seed-demo.ts`
 * (cuenta administradora + estos datos) crean exactamente el mismo escenario,
 * coherente con el modelo actual:
 *  - catalogos de escuelas, sedes y organizadores,
 *  - 5 estudiantes,
 *  - 4 eventos con fechas calendario (sin hora) y sello de autoria,
 *  - 6 participaciones, siempre entre estudiante y evento de la misma escuela.
 *
 * Es idempotente: usa upsert por las claves funcionales y no borra datos.
 */
export interface AcademicDemoTotals {
  escuelas: number;
  sedes: number;
  organizadores: number;
  tiposEvento: number;
  estudiantes: number;
  eventos: number;
  participaciones: number;
}

export async function seedAcademicDemo(
  prisma: PrismaClient,
): Promise<AcademicDemoTotals> {
  // --- Catalogos ------------------------------------------------------------
  const schoolNames = [
    'CIENCIAS FARMACEUTICAS Y BIOQUIMICA',
    'INGENIERIA DE SISTEMAS',
    'DERECHO',
  ];
  const locationNames = ['FILIAL LIMA', 'SEDE CENTRAL', 'TRUJILLO'];
  const organizerNames = [
    'VICERRECTORIA ACADEMICA',
    'DIRECCION DE ESCUELA',
    'COMITE DE EVENTOS ACADEMICOS',
  ];
  // Nombres en ingles: la interfaz los traduce al espanol.
  const eventTypeNames = [
    'Congress',
    'Seminar',
    'Workshop',
    'Course',
    'Forum',
    'Conference',
    'Webinar',
    'Exhibition',
  ];

  const schools = new Map<string, number>();
  const locations = new Map<string, number>();
  const organizers = new Map<string, number>();
  const eventTypes = new Map<string, number>();

  for (const name of schoolNames) {
    const row = await prisma.professionalSchool.upsert({
      where: { name },
      create: { name, status: CatalogStatus.ACTIVE },
      update: {},
    });
    schools.set(name, row.id);
  }

  for (const name of locationNames) {
    const row = await prisma.location.upsert({
      where: { name },
      create: { name, status: CatalogStatus.ACTIVE },
      update: {},
    });
    locations.set(name, row.id);
  }

  for (const name of organizerNames) {
    const row = await prisma.organizer.upsert({
      where: { name },
      create: { name, status: CatalogStatus.ACTIVE },
      update: {},
    });
    organizers.set(name, row.id);
  }

  for (const name of eventTypeNames) {
    const row = await prisma.eventTypeCatalog.upsert({
      where: { name },
      create: { name, status: CatalogStatus.ACTIVE },
      update: {},
    });
    eventTypes.set(name, row.id);
  }

  // --- Estudiantes ----------------------------------------------------------
  const students = [
    {
      universityCode: '2213271',
      academicDegree: 'QUINTO',
      lastName: 'AGUILAR PEREZ',
      firstName: 'MARISOL SONIA',
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      locationId: locations.get('FILIAL LIMA')!,
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2213065',
      academicDegree: 'CUARTO',
      lastName: 'ALLCCAHUAMAN HUAMAN',
      firstName: 'JESUS',
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      locationId: locations.get('SEDE CENTRAL')!,
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2213099',
      academicDegree: 'TERCER',
      lastName: 'RAMIREZ',
      firstName: 'CAMILA',
      professionalSchoolId: schools.get('INGENIERIA DE SISTEMAS')!,
      locationId: locations.get('TRUJILLO')!,
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2214012',
      academicDegree: 'SEXTO',
      lastName: 'QUISPE MONTES',
      firstName: 'ANDRES',
      professionalSchoolId: schools.get('INGENIERIA DE SISTEMAS')!,
      locationId: locations.get('SEDE CENTRAL')!,
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2214550',
      academicDegree: 'PRIMER',
      lastName: 'TORRES VILLA',
      firstName: 'LUCIA',
      professionalSchoolId: schools.get('DERECHO')!,
      locationId: locations.get('FILIAL LIMA')!,
      status: StudentStatus.INACTIVE,
    },
  ];

  // --- Eventos --------------------------------------------------------------
  // Fechas a mediodia UTC: la columna es DATE y asi el dia no se desplaza en
  // zonas horarias negativas como la de Peru.
  const events = [
    {
      code: 'EVT-2026-001',
      name: 'Congreso Internacional de Educacion Superior',
      description: 'Evento academico internacional sobre innovacion en la educacion superior.',
      eventType: EventType.MULTI_DAY,
      eventTypeId: eventTypes.get('Congress')!,
      startDate: new Date('2026-10-05T12:00:00.000Z'),
      endDate: new Date('2026-10-07T12:00:00.000Z'),
      modality: EventModality.HYBRID,
      location: 'Auditorio Central, Sede Central',
      capacity: 400,
      organizerId: organizers.get('VICERRECTORIA ACADEMICA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 2,
      status: EventStatus.IN_PROGRESS,
      userCreate: 'Seed de demostracion',
      userUpdate: 'Seed de demostracion',
    },
    {
      code: 'EVT-2026-002',
      name: 'Taller de Bioseguridad en Laboratorios',
      description: 'Taller practico sobre protocolos de bioseguridad en laboratorios de salud.',
      eventType: EventType.SINGLE_DAY,
      eventTypeId: eventTypes.get('Workshop')!,
      startDate: new Date('2026-09-15T12:00:00.000Z'),
      endDate: new Date('2026-09-15T12:00:00.000Z'),
      modality: EventModality.PRESENTIAL,
      location: 'Laboratorio 3, Facultad de Ciencias Farmaceuticas y Bioquimica',
      capacity: 60,
      organizerId: organizers.get('DIRECCION DE ESCUELA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 1,
      status: EventStatus.SCHEDULED,
      userCreate: 'Seed de demostracion',
      userUpdate: 'Seed de demostracion',
    },
    {
      code: 'EVT-2026-003',
      name: 'Seminario de Biotecnologia Aplicada',
      description: 'Seminario virtual sobre aplicaciones de la biotecnologia en salud y agroindustria.',
      eventType: EventType.SINGLE_DAY,
      eventTypeId: eventTypes.get('Seminar')!,
      startDate: new Date('2026-07-20T12:00:00.000Z'),
      endDate: new Date('2026-07-20T12:00:00.000Z'),
      modality: EventModality.VIRTUAL,
      location: 'Plataforma virtual institucional',
      capacity: null,
      organizerId: organizers.get('COMITE DE EVENTOS ACADEMICOS')!,
      professionalSchoolId: schools.get('INGENIERIA DE SISTEMAS')!,
      credits: 1.5,
      status: EventStatus.COMPLETED,
      userCreate: 'Seed de demostracion',
      userUpdate: 'Seed de demostracion',
    },
    {
      code: 'EVT-2026-004',
      name: 'Foro de Innovacion Farmaceutica',
      description: 'Foro academico sobre innovacion y gestion en ciencias farmaceuticas.',
      eventType: EventType.SINGLE_DAY,
      eventTypeId: eventTypes.get('Forum')!,
      startDate: new Date('2026-06-12T12:00:00.000Z'),
      endDate: new Date('2026-06-12T12:00:00.000Z'),
      modality: EventModality.PRESENTIAL,
      location: 'Auditorio de la Facultad de Ciencias Farmaceuticas y Bioquimica',
      capacity: 120,
      organizerId: organizers.get('DIRECCION DE ESCUELA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 1,
      status: EventStatus.COMPLETED,
      userCreate: 'Seed de demostracion',
      userUpdate: 'Seed de demostracion',
    },
  ];

  const studentIds: Record<string, number> = {};
  const eventIds: Record<string, number> = {};

  for (const student of students) {
    const row = await prisma.student.upsert({
      where: { universityCode: student.universityCode },
      update: student,
      create: student,
    });
    studentIds[student.universityCode] = row.id;
  }

  for (const event of events) {
    const row = await prisma.event.upsert({
      where: { code: event.code },
      update: event,
      create: event,
    });
    eventIds[event.code] = row.id;
  }

  const participations = [
    // Marisol Sonia: 1.5 + 2 + 1 = 4.5 creditos. Verifica el calculo de creditos.
    {
      eventCode: 'EVT-2026-001',
      universityCode: '2213271',
      participationType: ParticipationType.PONENTE,
      participationDate: new Date('2026-10-05T09:00:00.000Z'),
      credits: 1.5,
      verificationCode: 'DC-2026-8F4K2P',
      grade: 16,
      status: ParticipationStatus.VALID,
    },
    {
      eventCode: 'EVT-2026-002',
      universityCode: '2213271',
      participationType: ParticipationType.ASISTENTE,
      participationDate: new Date('2026-09-15T09:00:00.000Z'),
      credits: 2,
      verificationCode: 'DC-2026-3K9M7Q',
      grade: null,
      status: ParticipationStatus.VALID,
    },
    {
      eventCode: 'EVT-2026-004',
      universityCode: '2213271',
      participationType: ParticipationType.ASISTENTE,
      participationDate: new Date('2026-06-12T10:00:00.000Z'),
      credits: 1,
      verificationCode: 'DC-2026-7T2B5X',
      grade: 18,
      status: ParticipationStatus.VALID,
    },
    // Pendiente: no suma creditos.
    {
      eventCode: 'EVT-2026-001',
      universityCode: '2213065',
      participationType: ParticipationType.ASISTENTE,
      participationDate: new Date('2026-10-05T08:30:00.000Z'),
      credits: 2,
      verificationCode: 'DC-2026-5R8W3N',
      grade: null,
      status: ParticipationStatus.PENDING,
    },
    {
      eventCode: 'EVT-2026-003',
      universityCode: '2213099',
      participationType: ParticipationType.PANELISTA,
      participationDate: new Date('2026-07-20T17:00:00.000Z'),
      credits: 2,
      verificationCode: 'DC-2026-2H6C4V',
      grade: 14,
      status: ParticipationStatus.VALID,
    },
    // Anulada: existe y conserva su codigo, pero no otorga creditos.
    {
      eventCode: 'EVT-2026-003',
      universityCode: '2214012',
      participationType: ParticipationType.INVITADO,
      participationDate: new Date('2026-07-20T17:00:00.000Z'),
      credits: 1.5,
      verificationCode: 'DC-2026-9J3L6Y',
      grade: null,
      status: ParticipationStatus.CANCELLED,
    },
  ];

  for (const participation of participations) {
    const data = {
      eventId: eventIds[participation.eventCode],
      studentId: studentIds[participation.universityCode],
      participationType: participation.participationType,
      participationDate: participation.participationDate,
      credits: participation.credits,
      verificationCode: participation.verificationCode,
      grade: participation.grade,
      status: participation.status,
    };

    await prisma.participation.upsert({
      where: {
        eventId_studentId: {
          eventId: data.eventId,
          studentId: data.studentId,
        },
      },
      update: data,
      create: data,
    });
  }

  return {
    escuelas: await prisma.professionalSchool.count(),
    sedes: await prisma.location.count(),
    organizadores: await prisma.organizer.count(),
    tiposEvento: await prisma.eventTypeCatalog.count(),
    estudiantes: await prisma.student.count(),
    eventos: await prisma.event.count(),
    participaciones: await prisma.participation.count(),
  };
}
