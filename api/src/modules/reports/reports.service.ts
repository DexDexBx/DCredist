import { Injectable } from '@nestjs/common';
import { ParticipationStatus, Prisma } from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventSummaryDto } from '../events/dto/event-participant.dto';
import { roundCredits } from '../students/students.service';
import { creditsProgress, creditsTarget } from '../../common/domain';
import {
  CreditsProgressDto,
  DashboardSummaryDto,
  SchoolCreditSummaryDto,
  TopStudentDto,
} from './dto/reports.dto';

const DAY_MS = 86_400_000;
const UPCOMING_DAYS = 90;

const eventInclude = {
  organizer: { select: { name: true } },
  professionalSchool: { select: { name: true } },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creditos por escuela profesional.
   *
   * Se resuelve con un GROUP BY sobre el JOIN students x participations: es la
   * unica forma de obtener el dato exacto sin una tabla de hechos. Los creditos
   * se derivan de participaciones VALID; no se reparte ni se estima nada.
   *
   * Un usuario de escuela solo recibe su propia fila.
   */
  async schoolCredits(actor: Actor): Promise<SchoolCreditSummaryDto[]> {
    const scope = actor.isGlobal
      ? Prisma.sql``
      : Prisma.sql`WHERE ps.id = ${actor.professionalSchoolId}`;

    const rows = await this.prisma.$queryRaw<
      {
        professionalSchool: string;
        students: number;
        activeStudents: number;
        participations: number;
        validParticipations: number;
        totalCredits: number;
      }[]
    >`
      SELECT
        ps.name                                                  AS "professionalSchool",
        COUNT(DISTINCT s.id)::int                                AS "students",
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'ACTIVE')::int
                                                             AS "activeStudents",
        COUNT(p.id)::int                                         AS "participations",
        COUNT(p.id) FILTER (WHERE p.status = 'VALID')::int       AS "validParticipations",
        COALESCE(SUM(p.credits) FILTER (WHERE p.status = 'VALID'), 0)::float
                                                             AS "totalCredits"
      FROM students s
      JOIN professional_schools ps ON ps.id = s."professionalSchoolId"
      LEFT JOIN participations p ON p."studentId" = s.id
      ${scope}
      GROUP BY ps.name
      ORDER BY "totalCredits" DESC, ps.name ASC
    `;

    return rows.map((row) => ({
      professionalSchool: row.professionalSchool,
      students: Number(row.students),
      activeStudents: Number(row.activeStudents),
      participations: Number(row.participations),
      validParticipations: Number(row.validParticipations),
      totalCredits: roundCredits(Number(row.totalCredits)),
    }));
  }

  /** Cifras del inicio: conteos, eventos de hoy y rankings. */
  async dashboard(actor: Actor): Promise<DashboardSummaryDto> {
    const schoolWhere: Prisma.EventWhereInput = actor.isGlobal
      ? {}
      : { professionalSchoolId: actor.professionalSchoolId };

    const [
      totalEvents,
      activeEvents,
      scheduledEvents,
      completedEvents,
      totalStudents,
      activeStudents,
      totalParticipations,
      creditsGrouped,
    ] = await Promise.all([
      this.prisma.event.count({ where: schoolWhere }),
      this.prisma.event.count({ where: { ...schoolWhere, status: 'IN_PROGRESS' } }),
      this.prisma.event.count({ where: { ...schoolWhere, status: 'SCHEDULED' } }),
      this.prisma.event.count({ where: { ...schoolWhere, status: 'COMPLETED' } }),
      this.prisma.student.count({ where: this.studentWhere(actor) }),
      this.prisma.student.count({ where: { ...this.studentWhere(actor), status: 'ACTIVE' } }),
      this.prisma.participation.count({ where: this.participationWhere(actor) }),
      this.prisma.participation.groupBy({
        by: ['status'],
        where: this.participationWhere(actor),
        _sum: { credits: true },
      }),
    ]);

    const totalCredits = roundCredits(
      creditsGrouped
        .filter((row) => row.status === ParticipationStatus.VALID)
        .reduce((total, row) => total + (row._sum.credits ?? 0), 0)
    );

    const now = new Date();
    const todayStart = beginOfDay(now);
    const todayEnd = endOfDay(now);
    const horizon = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS);

    const [todayEvents, nextEvents, topStudents, schoolSummaries, progress] = await Promise.all([
      this.eventsBetween(todayStart, todayEnd, actor),
      this.eventsBetween(new Date(now.getTime() + DAY_MS), horizon, actor),
      this.topStudents(actor),
      this.schoolCredits(actor),
      this.creditsProgress(actor, totalCredits),
    ]);

    return {
      totalEvents,
      activeEvents,
      scheduledEvents,
      completedEvents,
      totalStudents,
      activeStudents,
      totalParticipations,
      totalCredits,
      todayEvents,
      nextEvents,
      topStudents,
      schoolSummaries,
      creditsProgress: progress,
    };
  }

  /**
   * Avance global hacia la meta de creditos.
   *
   * El total de creditos ya viene calculado por el dashboard. Aqui solo se
   * cuenta cuantos estudiantes hay con creditos y cuantos ya cumplieron: la meta
   * se lee al vuelo, asi que cambiar `DCREDITS_CREDITS_TARGET` recalcula todo.
   */
  async creditsProgress(actor: Actor, knownTotalCredits?: number): Promise<CreditsProgressDto> {
    const target = creditsTarget();

    const rows = await this.prisma.participation.groupBy({
      by: ['studentId'],
      where: { ...this.participationWhere(actor), status: ParticipationStatus.VALID },
      _sum: { credits: true },
    });

    const totalStudents = await this.prisma.student.count({
      where: this.studentWhere(actor),
    });

    // El dashboard ya trajo el total: se reutiliza en lugar de repetir la
    // consulta. Como endpoint suelto, el total se deriva de las participaciones.
    const totalCredits =
      knownTotalCredits ??
      roundCredits(rows.reduce((total, row) => total + (row._sum.credits ?? 0), 0));

    const creditsByStudent = rows.map((row) => roundCredits(row._sum.credits ?? 0));
    const withCredits = creditsByStudent.filter((credits) => credits > 0);

    const averageProgress =
      withCredits.length === 0
        ? 0
        : roundCredits(
            withCredits.reduce((total, credits) => total + creditsProgress(credits, target), 0) /
              withCredits.length
          );

    const completed = withCredits.filter((credits) => credits >= target).length;

    return {
      creditsTarget: target,
      totalCredits: roundCredits(totalCredits),
      remainingCredits: roundCredits(Math.max(0, target * withCredits.length - totalCredits)),
      averageProgress,
      studentsCompleted: completed,
      studentsWithCredits: withCredits.length,
      totalStudents,
    };
  }

  /** Eventos que empiezan dentro del rango, con su conteo de vigentes. */
  private async eventsBetween(
    from: Date,
    to: Date,
    actor: Actor,
    limit?: number
  ): Promise<EventSummaryDto[]> {
    const events = await this.prisma.event.findMany({
      where: {
        startDate: { gte: from, lte: to },
        status: { notIn: ['CANCELLED', 'COMPLETED'] },
        ...(actor.isGlobal ? {} : { professionalSchoolId: actor.professionalSchoolId }),
      },
      include: eventInclude,
      orderBy: { startDate: 'asc' },
      ...(limit ? { take: limit } : {}),
    });

    return this.withRegisteredCount(events);
  }

  private async topStudents(actor: Actor, limit = 5): Promise<TopStudentDto[]> {
    const rows = await this.prisma.participation.groupBy({
      by: ['studentId'],
      where: { ...this.participationWhere(actor), status: ParticipationStatus.VALID },
      _sum: { credits: true },
      _count: { _all: true },
      orderBy: { _sum: { credits: 'desc' } },
      take: limit,
    });

    if (rows.length === 0) {
      return [];
    }

    const students = await this.prisma.student.findMany({
      where: { id: { in: rows.map((row) => row.studentId) } },
      select: { id: true, universityCode: true, firstName: true, lastName: true },
    });

    const byId = new Map(students.map((student) => [student.id, student]));

    return rows
      .map((row) => {
        const student = byId.get(row.studentId);

        return {
          studentId: row.studentId,
          name: student ? `${student.firstName} ${student.lastName}` : 'Estudiante',
          universityCode: student?.universityCode ?? '',
          credits: roundCredits(row._sum.credits ?? 0),
          participations: row._count._all,
        };
      })
      .filter((row) => row.credits > 0);
  }

  private async withRegisteredCount(events: EventRow[]): Promise<EventSummaryDto[]> {
    if (events.length === 0) {
      return [];
    }

    const grouped = await this.prisma.participation.groupBy({
      by: ['eventId'],
      where: { eventId: { in: events.map((event) => event.id) }, status: ParticipationStatus.VALID },
      _count: { _all: true },
    });

    const counts = new Map(grouped.map((row) => [row.eventId, row._count._all]));

    return events.map((event) => ({
      id: event.id,
      code: event.code,
      name: event.name,
      category: event.category,
      startDate: event.startDate,
      endDate: event.endDate,
      modality: event.modality,
      location: event.location,
      capacity: event.capacity,
      organizerId: event.organizerId,
      organizer: event.organizer.name,
      professionalSchoolId: event.professionalSchoolId,
      professionalSchool: event.professionalSchool.name,
      credits: event.credits,
      status: event.status,
      registeredCount: counts.get(event.id) ?? 0,
    }));
  }

  /** Estudiantes visibles para el actor. */
  private studentWhere(actor: Actor): Prisma.StudentWhereInput {
    return actor.isGlobal ? {} : { professionalSchoolId: actor.professionalSchoolId };
  }

  /** Participaciones visibles: siguen la escuela del evento. */
  private participationWhere(actor: Actor): Prisma.ParticipationWhereInput {
    return actor.isGlobal ? {} : { event: { professionalSchoolId: actor.professionalSchoolId } };
  }
}

function beginOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}
