import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import {
  CatalogStatus,
  ParticipationStatus,
  StudentStatus,
} from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { isGeneralSchool } from '../../common/actor/actor.guard';
import { assertCanReadSchool, assertCanWriteSchool } from '../../common/actor/school-scope';
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

/** El estudiante siempre viaja con los nombres de su escuela y su sede. */
const studentInclude = {
  professionalSchool: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado con filtros opcionales. Todos se combinan con AND.
   *
   * Cada fila trae su resumen de creditos: el padron siempre se consulta con
   * "creditos acumulados" y calcularlo aqui evita una peticion por estudiante.
   *
   * Un usuario de escuela solo ve el padron de su propia escuela; `general`
   * (cuenta global) ve todas.
   */
  async findAll(query: QueryStudentsDto, actor: Actor): Promise<StudentListItemDto[]> {
    const rows = await this.prisma.student.findMany({
      where: this.buildWhere(query, actor),
      include: {
        ...studentInclude,
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
        lastName: row.lastName,
        firstName: row.firstName,
        professionalSchoolId: row.professionalSchoolId,
        professionalSchool: row.professionalSchool.name,
        locationId: row.locationId,
        location: row.location.name,
        status: row.status,
        ...summary,
      };
    });
  }

  /**
   * Catalogos que alimentan los filtros del padron.
   *
   * Salen de las tablas reales, no de los valores que hoy usan los estudiantes,
   * para que una entrada recien creada aparezca aunque todavia no tenga filas.
   * La escuela `general` nunca se ofrece: no es una escuela real.
   */
  async findFacets(actor: Actor): Promise<StudentFacetsDto> {
    const schools = await this.prisma.professionalSchool.findMany({
      where: {
        status: CatalogStatus.ACTIVE,
        NOT: { name: { equals: 'general', mode: 'insensitive' } },
        ...(actor.isGlobal ? {} : { id: actor.professionalSchoolId }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const locations = await this.prisma.location.findMany({
      where: { status: CatalogStatus.ACTIVE },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return { professionalSchools: schools, locations };
  }

  async findOne(id: number, actor: Actor): Promise<StudentRow> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${id}".`);
    }

    assertCanReadSchool(actor, student.professionalSchoolId);

    return student;
  }

  /**
   * Ficha completa: datos del estudiante + participaciones + creditos.
   * Los creditos se derivan de las participaciones, no de una columna.
   */
  async findDetail(id: number, actor: Actor): Promise<StudentDetail> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { ...studentInclude, participations: { select: { id: true } } },
    });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${id}".`);
    }

    assertCanReadSchool(actor, student.professionalSchoolId);

    const summary = await this.getCreditSummary(id, actor);

    return {
      id: student.id,
      universityCode: student.universityCode,
      lastName: student.lastName,
      firstName: student.firstName,
      professionalSchoolId: student.professionalSchoolId,
      professionalSchool: student.professionalSchool.name,
      locationId: student.locationId,
      location: student.location.name,
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
  async getCreditSummary(
    studentId: number,
    actor: Actor
  ): Promise<StudentCreditSummaryDto> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { professionalSchoolId: true },
    });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${studentId}".`);
    }

    assertCanReadSchool(actor, student.professionalSchoolId);

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

  async create(dto: CreateStudentDto, actor: Actor): Promise<StudentRow> {
    await this.assertSchoolAssignable(dto.professionalSchoolId, actor);
    await this.assertLocationAssignable(dto.locationId);

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
          lastName: dto.lastName.trim(),
          firstName: dto.firstName.trim(),
          professionalSchoolId: dto.professionalSchoolId,
          locationId: dto.locationId,
          status: dto.status ?? StudentStatus.ACTIVE,
        },
        include: studentInclude,
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

  async update(id: number, dto: UpdateStudentDto, actor: Actor): Promise<StudentRow> {
    const current = await this.findOne(id, actor);
    const universityCode = dto.universityCode?.trim() ?? current.universityCode;

    if (dto.professionalSchoolId !== undefined) {
      // Un usuario de escuela no puede mover a nadie a otra escuela, ni sacar
      // registros de la suya.
      assertCanWriteSchool(actor, current.professionalSchoolId);
      await this.assertSchoolAssignable(dto.professionalSchoolId, actor);
    }

    if (dto.locationId !== undefined) {
      assertCanWriteSchool(actor, current.professionalSchoolId);
      await this.assertLocationAssignable(dto.locationId);
    }

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
          ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
          ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
          ...(dto.professionalSchoolId !== undefined
            ? { professionalSchoolId: dto.professionalSchoolId }
            : {}),
          ...(dto.locationId !== undefined ? { locationId: dto.locationId } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: studentInclude,
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
   * El archivo trae NOMBRES de escuela y sede (no ids). El backend los resuelve
   * contra el catalogo. La carga es estricta y atomica:
   *  - si una fila referencia una escuela o sede inexistente, no se escribe nada;
   *  - si un usuario de escuela intenta cargar otra escuela, no se escribe nada;
   *  - si todo es valido, crea los codigos nuevos y completa solo los datos
   *    vacios de los existentes.
   *
   * Los errores se devuelven juntos y con el numero de fila, para que la
   * institucion corrija el archivo de una sola vez.
   */
  async importStudents(
    dto: ImportStudentsDto,
    actor: Actor
  ): Promise<StudentImportResultDto> {
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

      if (!/^\d{7}$/.test(code)) {
        issues.push({
          row: index + 1,
          universityCode: code,
          code: 'INVALID_CODE',
          message: 'El codigo universitario debe tener exactamente 7 digitos.',
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

    // Catalogos completos: se resuelven por nombre sin distinguir mayusculas.
    const [schools, locations] = await Promise.all([
      this.prisma.professionalSchool.findMany({
        select: { id: true, name: true, status: true },
      }),
      this.prisma.location.findMany({
        select: { id: true, name: true, status: true },
      }),
    ]);

    const schoolByName = new Map(
      schools.map((row) => [importKey(row.name), row])
    );
    const locationByName = new Map(
      locations.map((row) => [importKey(row.name), row])
    );

    const existing = await this.prisma.student.findMany({
      where: { universityCode: { in: candidates.map((item) => item.code) } },
    });
    const byCode = new Map(existing.map((student) => [student.universityCode, student]));

    /** Datos ya resueltos de cada fila, listos para escribir. */
    const resolved: {
      index: number;
      code: string;
      schoolId: number;
      locationId: number;
      lastName: string;
      firstName: string;
      current: (typeof existing)[number] | undefined;
      schoolName: string;
      locationName: string;
    }[] = [];

    for (const item of candidates) {
      const row = item.row;
      const current = byCode.get(item.code);
      const schoolName = row.professionalSchool?.trim() ?? '';
      const locationName = row.location?.trim() ?? '';

      if (
        !row.lastName?.trim() ||
        !row.firstName?.trim() ||
        row.lastName.trim().length < 2 ||
        row.firstName.trim().length < 2
      ) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'MISSING_NAMES',
          message:
            'La fila debe traer apellidos y nombres de al menos 2 caracteres cada uno.',
        });
        continue;
      }

      if (!schoolName) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'MISSING_PROFESSIONAL_SCHOOL',
          message: 'La fila no trae escuela profesional.',
        });
        continue;
      }

      if (!locationName) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'MISSING_LOCATION',
          message: 'La fila no trae sede.',
        });
        continue;
      }

      const school = schoolByName.get(importKey(schoolName));

      if (!school) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'UNKNOWN_PROFESSIONAL_SCHOOL',
          message: `La escuela profesional "${schoolName}" no existe en el catalogo.`,
        });
        continue;
      }

      if (school.status !== CatalogStatus.ACTIVE) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'INACTIVE_PROFESSIONAL_SCHOOL',
          message: `La escuela profesional "${school.name}" esta inactiva.`,
        });
        continue;
      }

      if (isGeneralSchool(school.name)) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'UNKNOWN_PROFESSIONAL_SCHOOL',
          message: 'La escuela "general" no admite estudiantes: no es una escuela real.',
        });
        continue;
      }

      if (!actor.isGlobal && school.id !== actor.professionalSchoolId) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'FOREIGN_PROFESSIONAL_SCHOOL',
          message: `Solo puedes cargar estudiantes de tu escuela (${actor.professionalSchoolName}). La fila indica "${school.name}".`,
        });
        continue;
      }

      if (current && current.professionalSchoolId !== school.id) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'SCHOOL_MISMATCH',
          message: `El estudiante ya existe en otra escuela profesional; no se puede reasignar desde la importacion.`,
        });
        continue;
      }

      const location = locationByName.get(importKey(locationName));

      if (!location) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'UNKNOWN_LOCATION',
          message: `La sede "${locationName}" no existe en el catalogo.`,
        });
        continue;
      }

      if (location.status !== CatalogStatus.ACTIVE) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'INACTIVE_LOCATION',
          message: `La sede "${location.name}" esta inactiva.`,
        });
        continue;
      }

      if (current && current.locationId !== location.id) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'LOCATION_MISMATCH',
          message: 'El estudiante ya existe con otra sede; no se puede reasignar desde la importacion.',
        });
        continue;
      }

      resolved.push({
        index: item.index,
        code: item.code,
        schoolId: school.id,
        locationId: location.id,
        schoolName: school.name,
        locationName: location.name,
        lastName: row.lastName.trim(),
        firstName: row.firstName.trim(),
        current,
      });
    }

    if (issues.length > 0) {
      issues.sort((a, b) => a.row - b.row);

      throw new BadRequestException({
        statusCode: 400,
        message: `La importacion no se aplico: ${issues.length} fila(s) con errores. No se creo ni modifico ningun estudiante.`,
        issues,
      });
    }

    let created = 0;
    let enriched = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const item of resolved) {
        if (item.current) {
          // El estudiante ya existe: no se reasigna ni se pisa ningun dato.
          enriched++;
          continue;
        }

        await tx.student.create({
          data: {
            universityCode: item.code,
            lastName: item.lastName,
            firstName: item.firstName,
            professionalSchoolId: item.schoolId,
            locationId: item.locationId,
            status: StudentStatus.ACTIVE,
          },
        });

        created++;
      }
    });

    return { total: candidates.length, created, enriched, issues: [] };
  }

  /** Coincidencia parcial por codigo, apellidos o nombres. */
  private buildWhere(query: QueryStudentsDto, actor: Actor): Prisma.StudentWhereInput {
    const search = query.search?.trim();

    return {
      // Alcance por escuela: un usuario de escuela solo ve su padron.
      ...(actor.isGlobal ? {} : { professionalSchoolId: actor.professionalSchoolId }),
      ...(query.universityCode ? { universityCode: query.universityCode.trim() } : {}),
      ...(query.professionalSchoolId
        ? { professionalSchoolId: query.professionalSchoolId }
        : {}),
      ...(query.locationId ? { locationId: query.locationId } : {}),
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

  /**
   * Valida que la escuela exista, este activa, no sea `general` y que el actor
   * pueda asignarla. Solo un usuario global puede crear estudiantes en otra
   * escuela; uno de escuela queda atado a la suya.
   */
  private async assertSchoolAssignable(schoolId: number, actor: Actor): Promise<void> {
    const school = await this.prisma.professionalSchool.findUnique({
      where: { id: schoolId },
      select: { name: true, status: true },
    });

    if (!school || school.status !== CatalogStatus.ACTIVE) {
      throw new BadRequestException('La escuela profesional no existe o esta inactiva.');
    }

    if (isGeneralSchool(school.name)) {
      throw new BadRequestException(
        'La escuela "general" no admite estudiantes: no es una escuela real.'
      );
    }

    if (!actor.isGlobal && schoolId !== actor.professionalSchoolId) {
      throw new ForbiddenException('Solo puedes registrar estudiantes de tu propia escuela.');
    }
  }

  /** Valida que la sede exista y este activa. */
  private async assertLocationAssignable(locationId: number): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { status: true },
    });

    if (!location || location.status !== CatalogStatus.ACTIVE) {
      throw new BadRequestException('La sede no existe o esta inactiva.');
    }
  }
}

type ParticipationForSummary = {
  status: ParticipationStatus;
  credits: number;
  grade: string;
  eventId: number;
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
    pendingGrades: valid.filter((item) => item.grade === 'sin nota').length,
  };
}

/** Evita errores de coma flotante al sumar creditos (1.5 + 2 + 1 = 4.5). */
export function roundCredits(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Clave tolerante para resolver escuela y sede por nombre en la importacion:
 * ignora mayusculas, acentos y espacios repetidos. El nombre original se
 * conserva para el mensaje de error.
 */
function importKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
