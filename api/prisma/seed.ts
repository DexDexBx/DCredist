import {
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
 *  - 5 estudiantes
 *  - 3 eventos (se necesitan 3 para verificar creditos 1.5 + 2 + 1 = 4.5,
 *    porque un estudiante solo puede participar una vez por evento)
 *  - 6 participaciones
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada.
 * NO borra datos existentes.
 */

const prisma = createPrismaClient();

async function main(): Promise<void> {
  const students = [
    {
      universityCode: '2213271',
      academicDegree: 'QUINTO',
      lastName: 'AGUILAR PEREZ',
      firstName: 'MARISOL SONIA',
      professionalSchool: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA',
      headquarters: 'FILIAL LIMA',
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2213065',
      academicDegree: 'CUARTO',
      lastName: 'ALLCCAHUAMAN HUAMAN',
      firstName: 'JESUS',
      professionalSchool: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA',
      headquarters: 'SEDE CENTRAL',
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2213099',
      academicDegree: 'TERCER',
      lastName: 'RAMIREZ',
      firstName: 'CAMILA',
      professionalSchool: 'INGENIERIA DE SISTEMAS',
      headquarters: 'TRUJILLO',
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2214012',
      academicDegree: 'SEXTO',
      lastName: 'QUISPE MONTES',
      firstName: 'ANDRES',
      professionalSchool: 'INGENIERIA DE SISTEMAS',
      headquarters: 'SEDE CENTRAL',
      status: StudentStatus.ACTIVE,
    },
    {
      universityCode: '2214550',
      academicDegree: 'PRIMER',
      lastName: 'TORRES VILLA',
      firstName: 'LUCIA',
      professionalSchool: 'DERECHO',
      headquarters: 'FILIAL LIMA',
      status: StudentStatus.INACTIVE,
    },
  ];

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
      organizer: 'Vicerrectoria Academica',
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
      organizer: 'Direccion de Escuela',
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
      organizer: 'Comite de Eventos Academicos',
      credits: 1.5,
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
      eventCode: 'EVT-2026-003',
      universityCode: '2213271',
      participationType: ParticipationType.ASISTENTE,
      participationDate: new Date('2026-07-20T16:00:00.000Z'),
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
      eventCode: 'EVT-2026-001',
      universityCode: '2213099',
      participationType: ParticipationType.PANELISTA,
      participationDate: new Date('2026-10-06T11:00:00.000Z'),
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
    estudiantes: await prisma.student.count(),
    eventos: await prisma.event.count(),
    participaciones: await prisma.participation.count(),
  };

  console.log('Seed de DCredits completado:');
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
