import {
  CatalogStatus,
  EventModality,
  EventStatus,
  EventType,
  ParticipationStatus,
  ParticipationType,
  StudentStatus,
} from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';

/**
 * SEED MINIMO DE DCREDITS.
 *
 * Solo sirve para comprobar que las relaciones funcionan:
 *  - catalogos de escuelas, sedes y organizadores
 *  - 5 estudiantes
 *  - 4 eventos: cada participacion relaciona un estudiante y un evento de su
 *    misma escuela profesional (regla del dominio)
 *  - 6 participaciones; Marisol suma 1.5 + 2 + 1 = 4.5 creditos
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada.
 * NO borra datos existentes.
 */

const prisma = createPrismaClient();

async function main(): Promise<void> {
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

  const schools = new Map<string, number>();
  const locations = new Map<string, number>();
  const organizers = new Map<string, number>();

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
  const events = [
    {
      code: 'EVT-2026-001',
      name: 'Congreso Internacional de Educacion Superior',
      description: 'Evento academico internacional sobre innovacion en la educacion superior.',
      eventType: EventType.MULTI_DAY,
      category: 'Congreso',
      startDate: new Date('2026-10-05T00:00:00.000Z'),
      endDate: new Date('2026-10-07T00:00:00.000Z'),
      startTime: '08:30',
      endTime: '18:00',
      modality: EventModality.HYBRID,
      location: 'Auditorio Central, Sede Central',
      capacity: 400,
      organizerId: organizers.get('VICERRECTORIA ACADEMICA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 2,
      status: EventStatus.IN_PROGRESS,
    },
    {
      code: 'EVT-2026-002',
      name: 'Taller de Bioseguridad en Laboratorios',
      description: 'Taller practico sobre protocolos de bioseguridad en laboratorios de salud.',
      eventType: EventType.SINGLE_DAY,
      category: 'Taller',
      startDate: new Date('2026-09-15T00:00:00.000Z'),
      endDate: new Date('2026-09-15T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '13:00',
      modality: EventModality.PRESENTIAL,
      location: 'Laboratorio 3, Facultad de Ciencias Farmaceuticas y Bioquimica',
      capacity: 60,
      organizerId: organizers.get('DIRECCION DE ESCUELA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 1,
      status: EventStatus.SCHEDULED,
    },
    {
      code: 'EVT-2026-003',
      name: 'Seminario de Biotecnologia Aplicada',
      description: 'Seminario virtual sobre aplicaciones de la biotecnologia en salud y agroindustria.',
      eventType: EventType.SINGLE_DAY,
      category: 'Seminario',
      startDate: new Date('2026-07-20T00:00:00.000Z'),
      endDate: new Date('2026-07-20T00:00:00.000Z'),
      startTime: '16:00',
      endTime: '19:00',
      modality: EventModality.VIRTUAL,
      location: 'Plataforma virtual institucional',
      capacity: null,
      organizerId: organizers.get('COMITE DE EVENTOS ACADEMICOS')!,
      professionalSchoolId: schools.get('INGENIERIA DE SISTEMAS')!,
      credits: 1.5,
      status: EventStatus.COMPLETED,
    },
    {
      code: 'EVT-2026-004',
      name: 'Foro de Innovacion Farmaceutica',
      description: 'Foro academico sobre innovacion y gestion en ciencias farmaceuticas.',
      eventType: EventType.SINGLE_DAY,
      category: 'Foro',
      startDate: new Date('2026-06-12T00:00:00.000Z'),
      endDate: new Date('2026-06-12T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '13:00',
      modality: EventModality.PRESENTIAL,
      location: 'Auditorio de la Facultad de Ciencias Farmaceuticas y Bioquimica',
      capacity: 120,
      organizerId: organizers.get('DIRECCION DE ESCUELA')!,
      professionalSchoolId: schools.get('CIENCIAS FARMACEUTICAS Y BIOQUIMICA')!,
      credits: 1,
      status: EventStatus.COMPLETED,
    },
  ];

  const studentIds: Record<string, string> = {};
  const eventIds: Record<string, string> = {};

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
    // El evento EVT-2026-002 tiene grade = null y el EVT-2026-003 sin certificado.
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

  const totals = {
    escuelas: await prisma.professionalSchool.count(),
    sedes: await prisma.location.count(),
    organizadores: await prisma.organizer.count(),
    estudiantes: await prisma.student.count(),
    eventos: await prisma.event.count(),
    participaciones: await prisma.participation.count(),
  };

  console.log('Seed de DCredits completado:');
  console.log(`  escuelas      : ${totals.escuelas}`);
  console.log(`  sedes         : ${totals.sedes}`);
  console.log(`  organizadores : ${totals.organizadores}`);
  console.log(`  estudiantes   : ${totals.estudiantes}`);
  console.log(`  eventos       : ${totals.eventos}`);
  console.log(`  participaciones: ${totals.participaciones}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed fallido:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
