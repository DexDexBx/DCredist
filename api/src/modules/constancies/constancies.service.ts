import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  ConstancyStatus,
  ParticipationStatus,
} from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { creditsProgress, creditsTarget } from '../../common/domain';
import { buildConstancyCode } from '../../common/constancy-code';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  ConstancyDto,
  ConstancyVerificationResultDto,
} from './dto/constancy.dto';

const constancyInclude = {
  student: {
    include: {
      professionalSchool: { select: { name: true } },
      location: { select: { name: true } },
    },
  },
} satisfies Prisma.ConstancyInclude;

type ConstancyWithStudent = Prisma.ConstancyGetPayload<{
  include: typeof constancyInclude;
}>;

/** Redondeo de creditos para evitar errores de coma flotante. */
function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * CONSTANCIAS DE CREDITOS.
 *
 * Se emite una sola vez, cuando el estudiante alcanza la meta. El registro es
 * 1:1 con Student y su codigo es inmutable. Si los creditos cambian, se
 * actualizan `currentCredits` y `status`; el codigo, la fecha de emision y los
 * creditos originales se conservan.
 */
@Injectable()
export class ConstanciesService {
  private readonly logger = new Logger(ConstanciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula la constancia de un estudiante.
   *
   * - Si no existe y aun no llega a la meta, no crea nada.
   * - Si no existe y ya llego, la crea con su codigo definitivo.
   * - Si existe, actualiza creditos actuales y estado manteniendo el codigo.
   */
  async syncForStudent(studentId: number): Promise<ConstancyWithStudent | null> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, universityCode: true },
    });

    if (!student) {
      return null;
    }

    const totalCredits = await this.validCredits(studentId);
    const target = creditsTarget();
    const status =
      totalCredits >= target ? ConstancyStatus.ACTIVE : ConstancyStatus.INACTIVE;

    const existing = await this.prisma.constancy.findUnique({
      where: { studentId },
      include: constancyInclude,
    });

    if (!existing) {
      if (totalCredits < target) {
        return null;
      }

      const code = await this.generateUniqueCode(student);

      try {
        return await this.prisma.constancy.create({
          data: {
            code,
            studentId,
            creditsAtIssue: totalCredits,
            currentCredits: totalCredits,
            status: ConstancyStatus.ACTIVE,
          },
          include: constancyInclude,
        });
      } catch (error) {
        // Otra peticion pudo crear la constancia en paralelo.
        if (
          isUniqueViolation(error, 'studentId') ||
          isUniqueViolation(error, 'code')
        ) {
          return this.syncForStudent(studentId);
        }
        throw error;
      }
    }

    if (existing.currentCredits === totalCredits && existing.status === status) {
      return existing;
    }

    return this.prisma.constancy.update({
      where: { studentId },
      data: {
        currentCredits: totalCredits,
        status,
      },
      include: constancyInclude,
    });
  }

  /** Recalcula varias constancias (cargas masivas o cambios de evento). */
  async syncMany(studentIds: number[]): Promise<void> {
    const unique = [...new Set(studentIds)].filter((id) => Number.isInteger(id) && id > 0);

    for (const studentId of unique) {
      try {
        await this.syncForStudent(studentId);
      } catch (error) {
        this.logger.error(
          `No se pudo sincronizar la constancia del estudiante ${studentId}.`,
          error
        );
      }
    }
  }

  /** Constancia persistida de un estudiante, creandola si ya cumple la meta. */
  async findForStudent(studentId: number): Promise<ConstancyDto | null> {
    const row = await this.syncForStudent(studentId);
    return row ? toConstancyDto(row) : null;
  }

  /**
   * Verificacion administrativa por codigo.
   *
   * Primero intenta reconstruir el estudiante a partir del codigo para generar
   * constancias de estudiantes que ya cumplian la meta antes de esta migracion.
   */
  async verify(input: string, actor: Actor): Promise<ConstancyVerificationResultDto> {
    const raw = input.trim().toUpperCase();

    if (!raw) {
      return this.empty('INVALID_FORMAT', 'Ingresa el código de la constancia para verificar.');
    }

    const parts = raw.split('-');
    if (parts[0] !== 'CONST' || parts.length < 3) {
      return this.empty(
        'INVALID_FORMAT',
        'El código de constancia tiene el formato CONST-<código>-XXXXXX.'
      );
    }

    const universityCode = parts.slice(1, -1).join('-');
    const student = await this.prisma.student.findUnique({
      where: { universityCode },
      select: { id: true },
    });

    if (student) {
      await this.syncForStudent(student.id);
    }

    const row = await this.prisma.constancy.findFirst({
      where: { code: { equals: raw, mode: 'insensitive' } },
      include: constancyInclude,
    });

    if (!row) {
      return this.empty('NOT_FOUND', 'No encontramos ninguna constancia con ese código.');
    }

    // Un usuario de escuela no puede verificar constancias de otra escuela.
    if (!actor.isGlobal && row.student.professionalSchoolId !== actor.professionalSchoolId) {
      return this.empty('NOT_FOUND', 'No encontramos ninguna constancia con ese código.');
    }

    const summary = await this.summaryFor(row.studentId);
    const active = row.status === ConstancyStatus.ACTIVE;

    return {
      outcome: active ? 'VALID' : 'NOT_ISSUED',
      message: active
        ? 'Constancia verificada correctamente.'
        : `El código es válido, pero el estudiante ya no alcanza los ${summary.creditsTarget} créditos requeridos: la constancia no está vigente.`,
      constancy: toConstancyDto(row),
      student: {
        id: row.student.id,
        universityCode: row.student.universityCode,
        lastName: row.student.lastName,
        firstName: row.student.firstName,
        professionalSchoolId: row.student.professionalSchoolId,
        professionalSchool: row.student.professionalSchool.name,
        locationId: row.student.locationId,
        location: row.student.location.name,
        status: row.student.status,
      },
      summary,
      issuedOn: row.issuedAt,
      meetsRequirement: active,
    };
  }

  private async validCredits(studentId: number): Promise<number> {
    const grouped = await this.prisma.participation.groupBy({
      by: ['status'],
      where: { studentId },
      _sum: { credits: true },
    });

    const value =
      grouped.find((row) => row.status === ParticipationStatus.VALID)?._sum.credits ?? 0;

    return roundCredits(value);
  }

  private async summaryFor(studentId: number) {
    const [grouped, validRows] = await Promise.all([
      this.prisma.participation.groupBy({
        by: ['status'],
        where: { studentId },
        _count: { _all: true },
        _sum: { credits: true },
      }),
      this.prisma.participation.findMany({
        where: { studentId, status: ParticipationStatus.VALID },
        select: { eventId: true, grade: true },
      }),
    ]);

    const countOf = (status: ParticipationStatus): number =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;

    const totalCredits = roundCredits(
      grouped.find((row) => row.status === ParticipationStatus.VALID)?._sum.credits ?? 0
    );
    const target = creditsTarget();
    const totalParticipations = grouped.reduce(
      (total, row) => total + row._count._all,
      0
    );

    return {
      studentId,
      totalCredits,
      creditsTarget: target,
      progress: creditsProgress(totalCredits, target),
      remainingCredits: roundCredits(Math.max(0, target - totalCredits)),
      completed: totalCredits >= target,
      totalParticipations,
      validParticipations: countOf(ParticipationStatus.VALID),
      cancelledParticipations: countOf(ParticipationStatus.CANCELLED),
      pendingParticipations: countOf(ParticipationStatus.PENDING),
      eventsParticipated: new Set(validRows.map((row) => row.eventId)).size,
      pendingGrades: validRows.filter((row) => row.grade === 'sin nota').length,
      certificateCount: totalParticipations,
    };
  }

  private async generateUniqueCode(student: {
    id: number;
    universityCode: string;
  }): Promise<string> {
    const base = buildConstancyCode(student);
    let candidate = base;
    let suffix = 1;

    while (await this.prisma.constancy.findUnique({ where: { code: candidate } })) {
      candidate = `${base}-${suffix++}`;
    }

    return candidate;
  }

  private empty(
    outcome: 'NOT_FOUND' | 'INVALID_FORMAT',
    message: string
  ): ConstancyVerificationResultDto {
    return {
      outcome,
      message,
      constancy: null,
      student: null,
      summary: null,
      issuedOn: null,
      meetsRequirement: false,
    };
  }
}

function toConstancyDto(row: {
  code: string;
  status: ConstancyStatus;
  issuedAt: Date;
  creditsAtIssue: number;
  currentCredits: number;
}): ConstancyDto {
  return {
    code: row.code,
    status: row.status,
    issuedAt: row.issuedAt,
    creditsAtIssue: row.creditsAtIssue,
    currentCredits: row.currentCredits,
  };
}
