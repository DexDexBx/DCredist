import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { ParticipationStatus, StudentStatus } from '../../generated/prisma/client';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { creditsProgress, creditsTarget } from '../../common/domain';
import {
  CreateStudentDto,
  ImportStudentsDto,
  StudentImportIssueDto,
  StudentImportResultDto,
  UpdateStudentDto,
} from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { StudentCreditSummaryDto } from './dto/student-credit-summary.dto';
import { StudentDetail } from './dto/student-detail.dto';
import { StudentFacetsDto, StudentListItemDto } from './dto/student-list-item.dto';

type StudentRow = Prisma.StudentGetPayload<object>;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado con filtros opcionales. Todos se combinan con AND.
   *
   * Cada fila trae su resumen de creditos: el padron siempre se consulta con
   * "creditos acumulados" y calcularlo aqui evita una peticion por estudiante.
   */
  async findAll(query: QueryStudentsDto): Promise<StudentListItemDto[]> {
    const rows = await this.prisma.student.findMany({
      where: this.buildWhere(query),
      include: {
        participations: {
          select: {
            status: true,
            credits: true,
            grade: true,
            eventId: true,
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return rows.map((row) => {
      const summary = summarize(row.participations);

      return {
        id: row.id,
        universityCode: row.universityCode,
        academicDegree: row.academicDegree,
        lastName: row.lastName,
        firstName: row.firstName,
        professionalSchool: row.professionalSchool,
        headquarters: row.headquarters,
        status: row.status,
        ...summary,
      };
    });
  }

  /** Escuelas profesionales y sedes que ya existen: alimentan los filtros. */
  async findFacets(): Promise<StudentFacetsDto> {
    const [schools, headquarters] = await Promise.all([
      this.prisma.student.findMany({
        distinct: ['professionalSchool'],
        select: { professionalSchool: true },
        orderBy: { professionalSchool: 'asc' },
      }),
      this.prisma.student.findMany({
        distinct: ['headquarters'],
        select: { headquarters: true },
        orderBy: { headquarters: 'asc' },
      }),
    ]);

    return {
      professionalSchools: schools.map((row) => row.professionalSchool).filter(Boolean),
      headquarters: headquarters.map((row) => row.headquarters).filter(Boolean),
    };
  }

  async findOne(id: string): Promise<StudentRow> {
    const student = await this.prisma.student.findUnique({ where: { id } });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${id}".`);
    }

    return student;
  }

  /**
   * Ficha completa: datos del estudiante + participaciones + creditos.
   * Los creditos se derivan de las participaciones, no de una columna.
   */
  async findDetail(id: string): Promise<StudentDetail> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { participations: { select: { id: true } } },
    });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${id}".`);
    }

    const summary = await this.getCreditSummary(id);

    return {
      id: student.id,
      universityCode: student.universityCode,
      academicDegree: student.academicDegree,
      lastName: student.lastName,
      firstName: student.firstName,
      professionalSchool: student.professionalSchool,
      headquarters: student.headquarters,
      status: student.status,
      totalCredits: summary.totalCredits,
      totalParticipations: summary.totalParticipations,
      validParticipations: summary.validParticipations,
      cancelledParticipations: summary.cancelledParticipations,
      pendingParticipations: summary.pendingParticipations,
      participationIds: student.participations.map((item) => item.id),
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  /**
   * Creditos acumulados, calculados con SQL sobre PostgreSQL.
   *
   * Solo suma participaciones VALID: las PENDING y CANCELLED quedan fuera.
   * Los creditos nunca se guardan en students.
   */
  async getCreditSummary(studentId: string): Promise<StudentCreditSummaryDto> {
    const exists = await this.prisma.student.count({ where: { id: studentId } });

    if (exists === 0) {
      throw new NotFoundException(`No existe un estudiante con id "${studentId}".`);
    }

    const grouped = await this.prisma.participation.groupBy({
      by: ['status'],
      where: { studentId },
      _count: { _all: true },
      _sum: { credits: true },
    });

    const countOf = (status: ParticipationStatus): number =>
      grouped.find((row) => row.status === status)?._count._all ?? 0;

    const creditsOf = (status: ParticipationStatus): number =>
      roundCredits(grouped.find((row) => row.status === status)?._sum.credits ?? 0);

    const totalCredits = roundCredits(creditsOf(ParticipationStatus.VALID));
    const target = creditsTarget();

    return {
      studentId,
      totalCredits,
      creditsTarget: target,
      progress: creditsProgress(totalCredits, target),
      remainingCredits: roundCredits(Math.max(0, target - totalCredits)),
      completed: totalCredits >= target,
      totalParticipations: grouped.reduce((total, row) => total + row._count._all, 0),
      validParticipations: countOf(ParticipationStatus.VALID),
      cancelledParticipations: countOf(ParticipationStatus.CANCELLED),
      pendingParticipations: countOf(ParticipationStatus.PENDING),
    };
  }

  async create(dto: CreateStudentDto): Promise<StudentRow> {
    const universityCode = dto.universityCode.trim();

    const existing = await this.prisma.student.findUnique({ where: { universityCode } });

    if (existing) {
      throw new ConflictException(
        `Ya existe un estudiante con el codigo universitario "${universityCode}".`
      );
    }

    try {
      return await this.prisma.student.create({
        data: {
          universityCode,
          academicDegree: dto.academicDegree?.trim() ?? '',
          lastName: dto.lastName.trim(),
          firstName: dto.firstName.trim(),
          professionalSchool: dto.professionalSchool.trim(),
          headquarters: dto.headquarters.trim(),
          status: dto.status ?? StudentStatus.ACTIVE,
        },
      });
    } catch (error) {
      // La constraint UNIQUE de PostgreSQL es la garantia real.
      if (isUniqueViolation(error, 'universityCode')) {
        throw new ConflictException(
          `Ya existe un estudiante con el codigo universitario "${universityCode}".`
        );
      }
      this.logger.error('No se pudo crear el estudiante.', error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateStudentDto): Promise<StudentRow> {
    const current = await this.findOne(id);
    const universityCode = dto.universityCode?.trim() ?? current.universityCode;

    if (universityCode !== current.universityCode) {
      const taken = await this.prisma.student.findUnique({ where: { universityCode } });

      if (taken) {
        throw new ConflictException(
          `Ya existe un estudiante con el codigo universitario "${universityCode}".`
        );
      }
    }

    try {
      return await this.prisma.student.update({
        where: { id },
        data: {
          universityCode,
          ...(dto.academicDegree !== undefined ? { academicDegree: dto.academicDegree.trim() } : {}),
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.professionalSchool !== undefined
            ? { professionalSchool: dto.professionalSchool.trim() }
            : {}),
          ...(dto.headquarters !== undefined ? { headquarters: dto.headquarters.trim() } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'universityCode')) {
        throw new ConflictException(
          `Ya existe un estudiante con el codigo universitario "${universityCode}".`
        );
      }
      this.logger.error(`No se pudo actualizar el estudiante "${id}".`, error);
      throw error;
    }
  }

  /**
   * CARGA INCREMENTAL DEL PADRON.
   *
   * Nunca es destructiva:
   *  - codigo nuevo -> se crea,
   *  - codigo existente -> se completan SOLO los campos que estan vacios,
   *  - fila incompleta -> se reporta en `issues`, no se crea.
   *
   * Si la institucion envia el mismo archivo dos veces, el resultado es el
   * mismo: es idempotente.
   */
  async importStudents(dto: ImportStudentsDto): Promise<StudentImportResultDto> {
    const issues: StudentImportIssueDto[] = [];
    const seen = new Set<string>();
    const candidates: { index: number; code: string; row: (typeof dto.rows)[number] }[] = [];

    dto.rows.forEach((row, index) => {
      const code = row.universityCode?.trim() ?? '';

      if (!code) {
        issues.push({
          row: index + 1,
          universityCode: '',
          code: 'MISSING_CODE',
          message: 'La fila no tiene codigo universitario.',
        });
        return;
      }

      if (seen.has(code)) {
        issues.push({
          row: index + 1,
          universityCode: code,
          code: 'DUPLICATE_IN_FILE',
          message: 'El codigo ya aparece en una fila anterior del archivo.',
        });
        return;
      }

      seen.add(code);
      candidates.push({ index, code, row });
    });

    const existing = await this.prisma.student.findMany({
      where: { universityCode: { in: candidates.map((item) => item.code) } },
    });
    const byCode = new Map(existing.map((student) => [student.universityCode, student]));

    let created = 0;
    let enriched = 0;

    for (const item of candidates) {
      const row = item.row;
      const current = byCode.get(item.code);

      if (current) {
        // Solo se completa lo que falta: la carga nunca pisa datos existentes.
        const patch: Prisma.StudentUpdateInput = {};

        if (!current.academicDegree && row.academicDegree?.trim()) {
          patch.academicDegree = row.academicDegree.trim();
        }
        if (!current.professionalSchool && row.professionalSchool?.trim()) {
          patch.professionalSchool = row.professionalSchool.trim();
        }
        if (!current.headquarters && row.headquarters?.trim()) {
          patch.headquarters = row.headquarters.trim();
        }

        if (Object.keys(patch).length > 0) {
          await this.prisma.student.update({ where: { id: current.id }, data: patch });
        }

        enriched++;
        continue;
      }

      if (!row.lastName?.trim() || !row.firstName?.trim()) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'MISSING_NAMES',
          message: 'La fila no trae apellidos ni nombres: no se puede crear el estudiante.',
        });
        continue;
      }

      if (!row.professionalSchool?.trim() || !row.headquarters?.trim()) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'MISSING_SCHOOL',
          message: 'La fila no trae escuela profesional ni sede: no se puede crear el estudiante.',
        });
        continue;
      }

      try {
        await this.prisma.student.create({
          data: {
            universityCode: item.code,
            academicDegree: row.academicDegree?.trim() ?? '',
            lastName: row.lastName.trim(),
            firstName: row.firstName.trim(),
            professionalSchool: row.professionalSchool.trim(),
            headquarters: row.headquarters.trim(),
            status: StudentStatus.ACTIVE,
          },
        });
        created++;
      } catch (error) {
        this.logger.error(`No se pudo crear al estudiante "${item.code}".`, error);
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'DB_ERROR',
          message: `No se pudo guardar al estudiante ${item.code}.`,
        });
      }
    }

    issues.sort((a, b) => a.row - b.row);

    return { total: candidates.length, created, enriched, issues };
  }

  /** Coincidencia parcial por codigo, apellidos o nombres. */
  private buildWhere(query: QueryStudentsDto): Prisma.StudentWhereInput {
    const search = query.search?.trim();

    return {
      ...(query.universityCode ? { universityCode: query.universityCode.trim() } : {}),
      ...(query.professionalSchool ? { professionalSchool: query.professionalSchool.trim() } : {}),
      ...(query.headquarters ? { headquarters: query.headquarters.trim() } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { universityCode: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
}

type ParticipationForSummary = {
  status: ParticipationStatus;
  credits: number;
  grade: number | null;
  eventId: string;
};

/**
 * Resumen de creditos derivado de las participaciones, nunca almacenado.
 *
 * `creditsTarget` y `progress` se calculan contra la meta institucional: son
 * dinamicos, si la meta cambia todos los estudiantes quedan al dia sin
 * recalcular nada en la base de datos.
 */
function summarize(participations: ParticipationForSummary[]) {
  const valid = participations.filter((item) => item.status === ParticipationStatus.VALID);
  const totalCredits = roundCredits(valid.reduce((total, item) => total + item.credits, 0));
  const target = creditsTarget();

  return {
    totalCredits,
    creditsTarget: target,
    progress: creditsProgress(totalCredits, target),
    remainingCredits: roundCredits(Math.max(0, target - totalCredits)),
    completed: totalCredits >= target,
    totalParticipations: participations.length,
    validParticipations: valid.length,
    cancelledParticipations: participations.filter(
      (item) => item.status === ParticipationStatus.CANCELLED
    ).length,
    pendingParticipations: participations.filter((item) => item.status === ParticipationStatus.PENDING)
      .length,
    eventsParticipated: new Set(valid.map((item) => item.eventId)).size,
    pendingGrades: valid.filter((item) => item.grade === null || item.grade === undefined).length,
  };
}

/** Evita errores de coma flotante al sumar creditos (1.5 + 2 + 1 = 4.5). */
export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}