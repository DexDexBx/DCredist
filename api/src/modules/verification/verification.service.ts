import { Injectable } from '@nestjs/common';
import { ParticipationStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isValidVerificationCode, normalizeVerificationCode } from '../../common/verification-code';
import { roundCredits } from '../../modules/students/students.service';
import { VerificationResultDto } from './dto/verification-result.dto';
import { MIN_SUGGESTION_LENGTH } from './dto/suggest-verification-codes.dto';

/**
 * CONSULTA DE UN CODIGO DE PARTICIPACION.
 *
 * Reglas:
 *  - el codigo buscado es el verificationCode (DC-AAAA-XXXXXX),
 *  - ese mismo codigo es el del certificado,
 *  - una participacion anulada responde CANCELLED: el codigo existio, pero ya
 *    no otorga creditos,
 *  - la busqueda no distingue mayusculas y tolera el prefijo "DC-" omitido.
 */
@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(input: string): Promise<VerificationResultDto> {
    const raw = normalizeVerificationCode(input);

    if (!raw) {
      return this.empty('INVALID_FORMAT', 'Ingresa un código de participación para verificar.');
    }

    // "2026-8F4K2P" se acepta y se completa a "DC-2026-8F4K2P".
    const candidates = raw.startsWith('DC-') ? [raw] : [`DC-${raw}`, raw];

    if (!candidates.some((candidate) => isValidVerificationCode(candidate))) {
      return this.empty(
        'INVALID_FORMAT',
        `El código "${input.trim()}" no tiene el formato válido (DC-AAAA-XXXXXX).`
      );
    }

    const participation = await this.prisma.participation.findFirst({
      where: { verificationCode: { in: candidates } },
      include: { event: true, student: true },
    });

    if (!participation) {
      return this.empty('NOT_FOUND', 'No encontramos ninguna participación con ese código.');
    }

    const credits = await this.creditSummary(participation.studentId);
    const base: Omit<VerificationResultDto, 'outcome' | 'message'> = {
      participation: {
        id: participation.id,
        participationType: participation.participationType,
        participationDate: participation.participationDate,
        credits: participation.credits,
        verificationCode: participation.verificationCode,
        grade: participation.grade,
        status: participation.status,
      },
      event: {
        id: participation.event.id,
        code: participation.event.code,
        name: participation.event.name,
        category: participation.event.category,
        startDate: participation.event.startDate,
        endDate: participation.event.endDate,
        modality: participation.event.modality,
        location: participation.event.location,
        organizer: participation.event.organizer,
        credits: participation.event.credits,
        status: participation.event.status,
      },
      student: {
        id: participation.student.id,
        universityCode: participation.student.universityCode,
        academicDegree: participation.student.academicDegree,
        lastName: participation.student.lastName,
        firstName: participation.student.firstName,
        professionalSchool: participation.student.professionalSchool,
        headquarters: participation.student.headquarters,
        status: participation.student.status,
      },
      credits,
    };

    if (participation.status === ParticipationStatus.CANCELLED) {
      return {
        ...base,
        outcome: 'CANCELLED',
        message: 'La participación existe, pero fue anulada y no otorga créditos.',
        credits: null,
      };
    }

    if (participation.status === ParticipationStatus.PENDING) {
      return {
        ...base,
        outcome: 'VALID',
        message: 'La participación está registrada y pendiente de confirmación.',
      };
    }

    return { ...base, outcome: 'VALID', message: 'Participación verificada correctamente.' };
  }

  /** Codigos que empiezan con lo que el usuario escribe, para sugerir. */
  async suggest(input: string, limit = 5): Promise<string[]> {
    const needle = normalizeVerificationCode(input).replace(/^DC-/, '');

    // Menos de 3 caracteres no consulta la base: el campo de busqueda pide
    // sugerencias en cada tecla y una lista vacia es la respuesta honesta.
    if (needle.length < MIN_SUGGESTION_LENGTH) {
      return [];
    }

    const rows = await this.prisma.participation.findMany({
      where: { verificationCode: { contains: needle } },
      select: { verificationCode: true },
      take: limit,
      orderBy: { participationDate: 'desc' },
    });

    return rows.map((row) => row.verificationCode);
  }

  private async creditSummary(studentId: string) {
    const grouped = await this.prisma.participation.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { _all: true },
      _sum: { credits: true },
    });

    const countOf = (status: ParticipationStatus): number =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;

    const creditsOf = (status: ParticipationStatus): number =>
      grouped.find((row) => row.status === status)?._sum.credits ?? 0;

    return {
      totalCredits: roundCredits(creditsOf(ParticipationStatus.VALID)),
      totalParticipations: grouped.reduce((total, row) => total + row._count._all, 0),
      validParticipations: countOf(ParticipationStatus.VALID),
      cancelledParticipations: countOf(ParticipationStatus.CANCELLED),
      pendingParticipations: countOf(ParticipationStatus.PENDING),
    };
  }

  private empty(
    outcome: 'NOT_FOUND' | 'INVALID_FORMAT',
    message: string
  ): VerificationResultDto {
    return {
      outcome,
      message,
      participation: null,
      event: null,
      student: null,
      credits: null,
    };
  }
}