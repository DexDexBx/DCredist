import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { EventStatus, ParticipationStatus } from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { assertCanReadSchool } from '../../common/actor/school-scope';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  generateUniqueVerificationCode,
  normalizeVerificationCode,
} from '../../common/verification-code';
import {
  CreateParticipationDto,
  ImportParticipationsDto,
  ParticipationImportIssueDto,
  ParticipationImportResultDto,
  QueryParticipationsDto,
  UpdateParticipationDto,
} from './dto/create-participation.dto';
import { StudentParticipationDto } from './dto/student-participation.dto';

type ParticipationRow = Prisma.ParticipationGetPayload<object>;
type ParticipationWithEvent = Prisma.ParticipationGetPayload<{ include: { event: true } }>;
type ParticipationWithEventAndStudent = Prisma.ParticipationGetPayload<{
  include: { event: true; student: true };
}>;

const EVENT_INCLUDE = { event: true } as const;
const CONTEXT_INCLUDE = { event: true, student: true } as const;

@Injectable()
export class ParticipationsService {
  private readonly logger = new Logger(ParticipationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista global. `search` cubre codigo universitario, apellidos y nombres.
   *
   * El alcance sigue al evento: un usuario de escuela solo ve las
   * participaciones de los eventos de su escuela. Una cuenta `general` ve todo.
   */
  async findAll(
    query: QueryParticipationsDto,
    actor: Actor
  ): Promise<ParticipationWithEventAndStudent[]> {
    const search = query.search?.trim();

    return this.prisma.participation.findMany({
      where: {
        ...(actor.isGlobal ? {} : { event: { professionalSchoolId: actor.professionalSchoolId } }),
        ...(query.eventId ? { eventId: query.eventId } : {}),
        ...(query.studentId ? { studentId: query.studentId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.verificationCode
          ? { verificationCode: normalizeVerificationCode(query.verificationCode) }
          : {}),
        ...(search
          ? {
              student: {
                OR: [
                  { universityCode: { contains: search, mode: 'insensitive' } },
                  { lastName: { contains: search, mode: 'insensitive' } },
                  { firstName: { contains: search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: CONTEXT_INCLUDE,
      orderBy: { participationDate: 'desc' },
    });
  }

  async findOne(id: number, actor: Actor): Promise<ParticipationWithEvent> {
    const participation = await this.prisma.participation.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    });

    if (!participation) {
      throw new NotFoundException(`No existe una participacion con id "${id}".`);
    }

    assertCanReadSchool(actor, participation.event.professionalSchoolId);

    return participation;
  }

  /** Participaciones del estudiante con el evento resuelto, para su historial. */
  async findByStudent(studentId: number, actor: Actor): Promise<StudentParticipationDto[]> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { professionalSchoolId: true },
    });

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${studentId}".`);
    }

    assertCanReadSchool(actor, student.professionalSchoolId);

    const rows = await this.prisma.participation.findMany({
      where: { studentId },
      include: EVENT_INCLUDE,
      orderBy: { participationDate: 'desc' },
    });

    return rows.map((row) => this.toStudentParticipation(row));
  }

  async create(dto: CreateParticipationDto, actor: Actor): Promise<ParticipationWithEvent> {
    // Las dos referencias deben existir: la FK lo garantizaria, pero un 404
    // explicito es mas util que un error de constraint.
    const [event, student] = await Promise.all([
      this.prisma.event.findUnique({ where: { id: dto.eventId } }),
      this.prisma.student.findUnique({ where: { id: dto.studentId } }),
    ]);

    if (!event) {
      throw new NotFoundException(`No existe un evento con id "${dto.eventId}".`);
    }

    if (!student) {
      throw new NotFoundException(`No existe un estudiante con id "${dto.studentId}".`);
    }

    if (!actor.isGlobal && event.professionalSchoolId !== actor.professionalSchoolId) {
      throw new ForbiddenException('Solo puedes registrar participaciones de tu propia escuela.');
    }

    if (event.professionalSchoolId !== student.professionalSchoolId) {
      throw new BadRequestException(
        'El estudiante y el evento pertenecen a escuelas profesionales distintas.'
      );
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException(
        `El evento ${event.code} esta cancelado: no admite nuevas participaciones.`
      );
    }

    if (dto.credits !== undefined && dto.credits !== null && dto.credits < 0) {
      throw new BadRequestException('Los creditos no pueden ser negativos.');
    }

    // Regla central: un estudiante no puede registrarse dos veces en el mismo evento.
    const existing = await this.prisma.participation.findUnique({
      where: {
        eventId_studentId: { eventId: dto.eventId, studentId: dto.studentId },
      },
    });

    if (existing) {
      throw new ConflictException(
        `El estudiante ${student.universityCode} ya esta registrado en el evento ${event.code}.`
      );
    }

    await this.assertCapacity(event.id, event.capacity, event.code);

    // Los creditos SIEMPRE salen del evento: el cliente no puede alterarlos.
    const credits = event.credits;
    const participationDate = dto.participationDate
      ? new Date(dto.participationDate)
      : event.startDate;

    // El codigo DCredits lo genera el servidor y no se vuelve a generar nunca.
    const verificationCode = await generateUniqueVerificationCode(this.prisma);

    try {
      return await this.prisma.participation.create({
        data: {
          eventId: dto.eventId,
          studentId: dto.studentId,
          participationDate,
          credits,
          verificationCode,
          // undefined se guarda como NULL. Nunca se convierte en 0.
          grade: dto.grade ?? null,
          status: dto.status ?? ParticipationStatus.VALID,
        },
        include: EVENT_INCLUDE,
      });
    } catch (error) {
      if (isUniqueViolation(error, 'eventId,studentId') || isUniqueViolation(error, 'eventId')) {
        throw new ConflictException(
          `El estudiante ${student.universityCode} ya esta registrado en el evento ${event.code}.`
        );
      }

      // Colision del codigo DCredits. Es practicamente imposible por el
      // alfabeto de 33^6 combinaciones, pero se reintenta una sola vez con un
      // codigo nuevo en lugar de fallar.
      if (isUniqueViolation(error, 'verificationCode')) {
        this.logger.warn('Colision de verificationCode; se reintenta la generacion.');

        return this.prisma.participation.create({
          data: {
            eventId: dto.eventId,
            studentId: dto.studentId,
              participationDate,
            credits,
            verificationCode: await generateUniqueVerificationCode(this.prisma),
            grade: dto.grade ?? null,
            status: dto.status ?? ParticipationStatus.VALID,
          },
          include: EVENT_INCLUDE,
        });
      }

      this.logger.error('No se pudo crear la participacion.', error);
      throw error;
    }
  }

  /**
   * Edita una participacion.
   *
   * El verificationCode es inmutable: anular una participacion no genera un
   * codigo nuevo, solo cambia su estado.
   */
  async update(
    id: number,
    dto: UpdateParticipationDto,
    actor: Actor
  ): Promise<ParticipationWithEvent> {
    await this.findOne(id, actor);

    if (dto.credits !== undefined && dto.credits !== null && dto.credits < 0) {
      throw new BadRequestException('Los creditos no pueden ser negativos.');
    }

    try {
      return await this.prisma.participation.update({
        where: { id },
        data: {
          ...(dto.participationDate !== undefined
            ? { participationDate: new Date(dto.participationDate) }
            : {}),
          ...(dto.credits !== undefined && dto.credits !== null ? { credits: dto.credits } : {}),
          // null es un valor valido: significa "sin nota registrada".
          ...(dto.grade !== undefined ? { grade: dto.grade } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: EVENT_INCLUDE,
      });
    } catch (error) {
      this.logger.error(`No se pudo actualizar la participacion "${id}".`, error);
      throw error;
    }
  }

  /**
   * CARGA MASIVA de participantes de un evento.
   *
   * Reglas:
   *  - identifica a los estudiantes por codigo universitario,
   *  - NUNCA crea estudiantes: los codigos ausentes se reportan,
   *  - solo admite estudiantes de la escuela del evento,
   *  - es idempotente: repetirla no duplica, marca ALREADY_REGISTERED,
   *  - es fila a fila: un error no descarta el resto del archivo.
   */
  async importParticipations(
    dto: ImportParticipationsDto,
    actor: Actor
  ): Promise<ParticipationImportResultDto> {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });

    if (!event) {
      throw new NotFoundException(`No existe un evento con id "${dto.eventId}".`);
    }

    assertCanReadSchool(actor, event.professionalSchoolId);

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException(
        `El evento ${event.code} esta cancelado: no admite nuevas participaciones.`
      );
    }

    const issues: ParticipationImportIssueDto[] = [];
    const seen = new Set<string>();
    /** Indices de `rows` que quedan por registrar, en orden de archivo. */
    const pending: { index: number; code: string }[] = [];

    dto.rows.forEach((row, index) => {
      const code = row.universityCode?.trim() ?? '';

      if (!code) {
        issues.push({
          row: index + 1,
          universityCode: '',
          code: 'INVALID_ROW',
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
      pending.push({ index, code });
    });

    const students = await this.prisma.student.findMany({
      where: { universityCode: { in: pending.map((item) => item.code) } },
      select: {
        id: true,
        universityCode: true,
        status: true,
        professionalSchoolId: true,
      },
    });

    const byCode = new Map(students.map((student) => [student.universityCode, student]));

    const alreadyRegistered = new Set(
      (
        await this.prisma.participation.findMany({
          where: { eventId: event.id },
          select: { studentId: true },
        })
      ).map((participation) => participation.studentId)
    );

    // Cupo disponible: solo las participaciones VALID ocupan lugar.
    let usedSlots = await this.prisma.participation.count({
      where: { eventId: event.id, status: ParticipationStatus.VALID },
    });
    const hasCapacityLimit = typeof event.capacity === 'number' && event.capacity > 0;

    const insertable: { index: number; studentId: number }[] = [];
    let found = 0;

    for (const item of pending) {
      const student = byCode.get(item.code);

      if (!student) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'STUDENT_NOT_FOUND',
          message: `El codigo ${item.code} no existe en el padron de estudiantes.`,
        });
        continue;
      }

      found++;

      if (student.professionalSchoolId !== event.professionalSchoolId) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'STUDENT_OTHER_SCHOOL',
          message: `El estudiante ${item.code} pertenece a otra escuela profesional y no puede participar en este evento.`,
        });
        continue;
      }

      if (student.status !== 'ACTIVE') {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'STUDENT_INACTIVE',
          message: `El estudiante ${item.code} esta inactivo en el padron.`,
        });
        continue;
      }

      if (alreadyRegistered.has(student.id)) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'ALREADY_REGISTERED',
          message: `El estudiante ${item.code} ya participa en el evento ${event.code}.`,
        });
        continue;
      }

      if (hasCapacityLimit && usedSlots >= (event.capacity as number)) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'EVENT_FULL',
          message: `El evento ${event.code} alcanzo su capacidad de ${event.capacity}.`,
        });
        continue;
      }

      alreadyRegistered.add(student.id);
      usedSlots++;
      insertable.push({ index: item.index, studentId: student.id });
    }

    const registered = await this.insertImportedRows(dto, event, insertable, issues);

    issues.sort((a, b) => a.row - b.row);

    return {
      total: pending.length,
      registered,
      found,
      skipped: issues.length,
      issues,
    };
  }

  /**
   * Inserta las filas validas del archivo.
   *
   * Se intenta un solo INSERT. Si una constraint UNIQUE salta (por ejemplo una
   * colision de verificationCode), se reintenta fila a fila para no perder el
   * resto de la carga.
   */
  private async insertImportedRows(
    dto: ImportParticipationsDto,
    event: { id: number; startDate: Date; credits: number; code: string },
    insertable: { index: number; studentId: number }[],
    issues: ParticipationImportIssueDto[]
  ): Promise<number> {
    if (insertable.length === 0) {
      return 0;
    }

    const defaultCredits = dto.defaultCredits ?? event.credits;

    const data = insertable.map(({ index, studentId }) => {
      const row = dto.rows[index];

      return {
        eventId: event.id,
        studentId,
        participationDate: row.participationDate ? new Date(row.participationDate) : event.startDate,
        credits: row.credits ?? defaultCredits,
        verificationCode: '',
        grade: row.grade ?? null,
        status: row.status ?? ParticipationStatus.VALID,
      };
    });

    // Un codigo por fila: se generan antes de insertar para que el INSERT sea
    // una sola sentencia.
    for (let index = 0; index < data.length; index++) {
      data[index].verificationCode = await generateUniqueVerificationCode(this.prisma);
    }

    try {
      const result = await this.prisma.participation.createMany({ data });
      return result.count;
    } catch (error) {
      this.logger.warn(
        `La carga por lotes de ${data.length} filas fallo; se reintenta fila a fila.`,
        error
      );

      let registered = 0;

      for (let index = 0; index < data.length; index++) {
        try {
          await this.prisma.participation.create({ data: data[index] });
          registered++;
        } catch (rowError) {
          const code = dto.rows[insertable[index].index].universityCode.trim();
          const duplicate =
            isUniqueViolation(rowError, 'eventId,studentId') ||
            isUniqueViolation(rowError, 'verificationCode');

          issues.push({
            row: insertable[index].index + 1,
            universityCode: code,
            code: duplicate ? 'ALREADY_REGISTERED' : 'DB_ERROR',
            message: duplicate
              ? `No se pudo registrar ${code}: el registro ya existe.`
              : `No se pudo registrar ${code}: error de base de datos.`,
          });
        }
      }

      return registered;
    }
  }

  private async assertCapacity(
    eventId: number,
    capacity: number | null | undefined,
    eventCode: string
  ): Promise<void> {
    if (capacity === null || capacity === undefined || capacity === 0) {
      return;
    }

    const valid = await this.prisma.participation.count({
      where: { eventId, status: ParticipationStatus.VALID },
    });

    if (valid >= capacity) {
      throw new ConflictException(`El evento ${eventCode} alcanzo su capacidad maxima.`);
    }
  }

  private toStudentParticipation(row: ParticipationWithEvent): StudentParticipationDto {
    return {
      id: row.id,
      eventId: row.eventId,
      studentId: row.studentId,
      eventCode: row.event.code,
      eventName: row.event.name,
      participationDate: row.participationDate,
      credits: row.credits,
      verificationCode: row.verificationCode,
      grade: row.grade,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export type { ParticipationRow };
