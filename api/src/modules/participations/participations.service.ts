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
  EventStatus,
  ParticipationOrigin,
  ParticipationStatus,
  StudentStatus,
  UserRole,
} from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { assertCanReadSchool } from '../../common/actor/school-scope';
import { BULK_INSERT_BATCH_SIZE, chunk } from '../../common/prisma/bulk';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConstanciesService } from '../constancies/constancies.service';
import {
  MAX_VERIFICATION_CODE_LENGTH,
  generateUniqueVerificationCode,
  generateUniqueVerificationCodes,
  historicalCodeKey,
  normalizeHistoricalCode,
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
import { EligibleStudentDto } from './dto/eligible-student.dto';

type ParticipationRow = Prisma.ParticipationGetPayload<object>;
type ParticipationWithEvent = Prisma.ParticipationGetPayload<{ include: { event: true } }>;
type ParticipationWithEventAndStudent = Prisma.ParticipationGetPayload<{
  include: { event: true; student: true };
}>;

const EVENT_INCLUDE = { event: true } as const;
const CONTEXT_INCLUDE = {
  event: true,
  student: {
    include: {
      professionalSchool: { select: { name: true } },
      location: { select: { name: true } },
    },
  },
} as const;

@Injectable()
export class ParticipationsService {
  private readonly logger = new Logger(ParticipationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly constancies: ConstanciesService
  ) {}

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
          ? {
              // Acepta el codigo generado y el codigo original de un registro
              // historico, sin distinguir mayusculas.
              verificationCode: {
                equals: query.verificationCode.trim(),
                mode: 'insensitive',
              },
            }
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

  /**
   * Estudiantes disponibles para un evento.
   *
   * Es el unico punto donde se consultan estudiantes de TODAS las escuelas:
   * un evento de una escuela puede recibir asistentes de otras. El actor sigue
   * limitado a operar eventos de su propia escuela.
   *
   * Excluye a quienes ya tienen cualquier participacion en el evento.
   */
  async findEligibleStudents(eventId: number, actor: Actor): Promise<EligibleStudentDto[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { professionalSchoolId: true },
    });

    if (!event) {
      throw new NotFoundException(`No existe un evento con id "${eventId}".`);
    }

    assertCanReadSchool(actor, event.professionalSchoolId);

    const rows = await this.prisma.student.findMany({
      where: {
        status: StudentStatus.ACTIVE,
        participations: { none: { eventId } },
      },
      select: {
        id: true,
        universityCode: true,
        lastName: true,
        firstName: true,
        professionalSchoolId: true,
        professionalSchool: { select: { name: true } },
        locationId: true,
        location: { select: { name: true } },
        status: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      universityCode: row.universityCode,
      lastName: row.lastName,
      firstName: row.firstName,
      professionalSchoolId: row.professionalSchoolId,
      professionalSchool: row.professionalSchool.name,
      locationId: row.locationId,
      location: row.location.name,
      status: row.status,
    }));
  }

  /**
   * Directorio ligero de estudiantes para el modulo de participaciones.
   *
   * Permite resolver el nombre, escuela y sede de participaciones de estudiantes
   * de otras escuelas, sin exponer ese padron en el modulo de estudiantes.
   */
  async findStudentDirectory(): Promise<EligibleStudentDto[]> {
    const rows = await this.prisma.student.findMany({
      // Solo se necesitan quienes ya aparecen en alguna participacion.
      where: { participations: { some: {} } },
      select: {
        id: true,
        universityCode: true,
        lastName: true,
        firstName: true,
        professionalSchoolId: true,
        professionalSchool: { select: { name: true } },
        locationId: true,
        location: { select: { name: true } },
        status: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      universityCode: row.universityCode,
      lastName: row.lastName,
      firstName: row.firstName,
      professionalSchoolId: row.professionalSchoolId,
      professionalSchool: row.professionalSchool.name,
      locationId: row.locationId,
      location: row.location.name,
      status: row.status,
    }));
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
      : toCalendarNoon(event.startDate);

    const origin = dto.origin ?? ParticipationOrigin.CURRENT;
    const historicalCode = normalizeHistoricalCode(dto.verificationCode);

    if (origin === ParticipationOrigin.LEGACY) {
      if (!historicalCode) {
        throw new BadRequestException(
          'El registro historico requiere el codigo de verificacion original.'
        );
      }

      if (historicalCode.length > MAX_VERIFICATION_CODE_LENGTH) {
        throw new BadRequestException(
          `El codigo de verificacion no puede superar ${MAX_VERIFICATION_CODE_LENGTH} caracteres.`
        );
      }

      const taken = await this.prisma.participation.findFirst({
        where: {
          eventId: dto.eventId,
          verificationCode: { equals: historicalCode, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (taken) {
        throw new ConflictException(
          `El codigo de verificacion "${historicalCode}" ya esta asignado a otra participacion.`
        );
      }
    } else if (historicalCode) {
      // Un registro actual no puede imponer su codigo: lo genera el sistema.
      throw new BadRequestException(
        'El codigo de verificacion solo se acepta en registros historicos.'
      );
    }

    // En CURRENT el codigo lo genera el servidor. En LEGACY se conserva el
    // codigo original, tal como lo traia la data antigua.
    const verificationCode =
      origin === ParticipationOrigin.LEGACY
        ? historicalCode
        : await generateUniqueVerificationCode(this.prisma);

    try {
      const created = await this.prisma.participation.create({
        data: {
          eventId: dto.eventId,
          studentId: dto.studentId,
          participationDate,
          credits,
          verificationCode,
          origin,
          // undefined se guarda como NULL. Nunca se convierte en 0.
          grade: normalizeGrade(dto.grade),
          status: dto.status ?? ParticipationStatus.VALID,
          descriptionStatus: dto.descriptionStatus?.trim() || 'valid',
          userCreate: authorName(actor),
          userUpdate: authorName(actor),
        },
        include: EVENT_INCLUDE,
      });

      await this.syncConstancy(dto.studentId);
      return created;
    } catch (error) {
      if (isUniqueViolation(error, 'eventId,studentId') || isUniqueViolation(error, 'eventId')) {
        throw new ConflictException(
          `El estudiante ${student.universityCode} ya esta registrado en el evento ${event.code}.`
        );
      }

      if (isUniqueViolation(error, 'verificationCode')) {
        // En un registro historico el codigo lo eligio la institucion: no se
        // regenera, porque eso alteraria la data antigua.
        if (origin === ParticipationOrigin.LEGACY) {
          throw new ConflictException(
            `El codigo de verificacion "${historicalCode}" ya esta asignado a otra participacion.`
          );
        }

        // Colision del codigo DCredits. Es practicamente imposible por el
        // alfabeto de 33^6 combinaciones, pero se reintenta una sola vez con un
        // codigo nuevo en lugar de fallar.
        this.logger.warn('Colision de verificationCode; se reintenta la generacion.');

        const created = await this.prisma.participation.create({
          data: {
            eventId: dto.eventId,
            studentId: dto.studentId,
            participationDate,
            credits,
            verificationCode: await generateUniqueVerificationCode(this.prisma),
            origin,
            grade: normalizeGrade(dto.grade),
            status: dto.status ?? ParticipationStatus.VALID,
            descriptionStatus: dto.descriptionStatus?.trim() || 'valid',
            userCreate: authorName(actor),
            userUpdate: authorName(actor),
          },
          include: EVENT_INCLUDE,
        });

        await this.syncConstancy(dto.studentId);
        return created;
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
    const participation = await this.findOne(id, actor);

    if (dto.credits !== undefined && dto.credits !== null && dto.credits < 0) {
      throw new BadRequestException('Los creditos no pueden ser negativos.');
    }

    const reason = dto.descriptionStatus?.trim() ?? '';
    const statusChanged =
      dto.status !== undefined && dto.status !== participation.status;
    const requiresReason =
      statusChanged &&
      (dto.status === ParticipationStatus.CANCELLED ||
        (dto.status === ParticipationStatus.VALID &&
          participation.status === ParticipationStatus.CANCELLED));

    if (requiresReason && !reason) {
      throw new BadRequestException(
        dto.status === ParticipationStatus.CANCELLED
          ? 'Indica el motivo de la anulacion.'
          : 'Indica el motivo de la reactivacion.'
      );
    }

    try {
      const updated = await this.prisma.participation.update({
        where: { id },
        data: {
          ...(dto.participationDate !== undefined
            ? { participationDate: new Date(dto.participationDate) }
            : {}),
          ...(dto.credits !== undefined && dto.credits !== null ? { credits: dto.credits } : {}),
          // null es un valor valido: significa "sin nota registrada".
          ...(dto.grade !== undefined ? { grade: normalizeGrade(dto.grade) } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.descriptionStatus !== undefined ? { descriptionStatus: reason } : {}),
          // Cada modificacion registra quien la hizo; userCreate no se toca.
          userUpdate: authorName(actor),
        },
        include: EVENT_INCLUDE,
      });

      await this.syncConstancy(participation.studentId);
      return updated;
    } catch (error) {
      this.logger.error(`No se pudo actualizar la participacion "${id}".`, error);
      throw error;
    }
  }

  /**
   * Elimina definitivamente una participacion. Solo administradores.
   *
   * Es un borrado fisico: libera el cupo del evento y deja de existir para
   * creditos, reportes y verificacion. No se puede recuperar.
   */
  async remove(id: number, actor: Actor): Promise<{ deleted: boolean }> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo un administrador puede eliminar participaciones.');
    }

    const participation = await this.findOne(id, actor);
    await this.prisma.participation.delete({ where: { id } });
    await this.syncConstancy(participation.studentId);
    return { deleted: true };
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
    const origin = dto.origin ?? ParticipationOrigin.CURRENT;
    const isLegacy = origin === ParticipationOrigin.LEGACY;
    const legacyCodesSeen = new Set<string>();
    /** Indices de `rows` que quedan por registrar, en orden de archivo. */
    const pending: { index: number; code: string; verificationCode?: string }[] = [];

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

      const historicalCode = normalizeHistoricalCode(row.verificationCode);

      if (isLegacy) {
        if (!historicalCode) {
          issues.push({
            row: index + 1,
            universityCode: code,
            code: 'MISSING_VERIFICATION_CODE',
            message:
              'Falta el codigo de verificacion original: es obligatorio en una carga historica.',
          });
          return;
        }

        if (historicalCode.length > MAX_VERIFICATION_CODE_LENGTH) {
          issues.push({
            row: index + 1,
            universityCode: code,
            code: 'INVALID_ROW',
            message: `El codigo de verificacion no puede superar ${MAX_VERIFICATION_CODE_LENGTH} caracteres.`,
          });
          return;
        }

        const legacyKey = historicalCodeKey(historicalCode);

        if (legacyCodesSeen.has(legacyKey)) {
          issues.push({
            row: index + 1,
            universityCode: code,
            code: 'DUPLICATE_VERIFICATION_CODE',
            message: `El codigo de verificacion "${historicalCode}" se repite en el archivo.`,
          });
          return;
        }

        legacyCodesSeen.add(legacyKey);
        seen.add(code);
        pending.push({ index, code, verificationCode: historicalCode });
        return;
      }

      if (historicalCode) {
        issues.push({
          row: index + 1,
          universityCode: code,
          code: 'INVALID_ROW',
          message:
            'La carga actual no admite codigos de verificacion: usa el modo historico para conservarlos.',
        });
        return;
      }

      seen.add(code);
      pending.push({ index, code });
    });

    // Un codigo historico no puede existir ya en otra participacion. Se
    // resuelve en UNA consulta para toda la carga.
    const storedLegacyCodes = isLegacy
      ? new Set(
          (
            await this.prisma.participation.findMany({
              where: {
                eventId: event.id,
                verificationCode: {
                  in: pending.map((item) => item.verificationCode as string),
                  mode: 'insensitive',
                },
              },
              select: { verificationCode: true },
            })
          ).map((row) => historicalCodeKey(row.verificationCode))
        )
      : new Set<string>();

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

    const insertable: {
      index: number;
      studentId: number;
      verificationCode?: string;
    }[] = [];
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

      if (isLegacy && storedLegacyCodes.has(historicalCodeKey(item.verificationCode))) {
        issues.push({
          row: item.index + 1,
          universityCode: item.code,
          code: 'DUPLICATE_VERIFICATION_CODE',
          message: `El codigo de verificacion "${item.verificationCode}" ya esta asignado a otra participacion de este evento.`,
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
      insertable.push({
        index: item.index,
        studentId: student.id,
        verificationCode: item.verificationCode,
      });
    }

    const registered = await this.insertImportedRows(dto, event, insertable, issues, origin, actor);

    // Los creditos pudieron cambiar con la carga: se actualizan las
    // constancias de todos los estudiantes alcanzados.
    await this.constancies.syncMany(insertable.map((item) => item.studentId));

    issues.sort((a, b) => a.row - b.row);

    return {
      total: pending.length,
      registered,
      found,
      skipped: issues.length,
      issues,
    };
  }

  /** Actualiza la constancia de un estudiante sin romper la operacion principal. */
  private async syncConstancy(studentId: number): Promise<void> {
    try {
      await this.constancies.syncForStudent(studentId);
    } catch (error) {
      this.logger.error(
        `No se pudo actualizar la constancia del estudiante ${studentId}.`,
        error
      );
    }
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
    insertable: { index: number; studentId: number; verificationCode?: string }[],
    issues: ParticipationImportIssueDto[],
    origin: ParticipationOrigin,
    actor: Actor
  ): Promise<number> {
    if (insertable.length === 0) {
      return 0;
    }

    const defaultCredits = dto.defaultCredits ?? event.credits;
    const isLegacy = origin === ParticipationOrigin.LEGACY;

    const data = insertable.map(({ index, studentId, verificationCode }) => {
      const row = dto.rows[index];

      return {
        eventId: event.id,
        studentId,
        participationDate: row.participationDate
          ? new Date(row.participationDate)
          : toCalendarNoon(event.startDate),
        credits: row.credits ?? defaultCredits,
        // En una carga historica se conserva el codigo original de la fila.
        verificationCode: isLegacy ? (verificationCode as string) : '',
        origin,
        grade: normalizeGrade(row.grade),
        status: row.status ?? ParticipationStatus.VALID,
        userCreate: authorName(actor),
        userUpdate: authorName(actor),
      };
    });

    if (!isLegacy) {
      // Un codigo por fila, generados en lote para no hacer una consulta por
      // cada estudiante de una carga de miles de filas.
      const codes = await generateUniqueVerificationCodes(this.prisma, data.length);
      data.forEach((item, index) => {
        item.verificationCode = codes[index];
      });
    }

    // Tandas de tamano seguro: miles de filas en un solo INSERT superan el
    // limite de parametros por sentencia de PostgreSQL. Si una tanda falla por
    // una constraint, solo esa tanda se reintenta fila a fila para no perder
    // el resto de la carga.
    let registered = 0;

    for (let start = 0; start < data.length; start += BULK_INSERT_BATCH_SIZE) {
      const batch = data.slice(start, start + BULK_INSERT_BATCH_SIZE);

      try {
        const result = await this.prisma.participation.createMany({ data: batch });
        registered += result.count;
      } catch (error) {
        this.logger.warn(
          `La carga por lotes de ${batch.length} filas fallo; se reintenta fila a fila.`,
          error
        );

        for (let offset = 0; offset < batch.length; offset++) {
          const index = start + offset;

          try {
            await this.prisma.participation.create({ data: data[index] });
            registered++;
          } catch (rowError) {
            const code = dto.rows[insertable[index].index].universityCode.trim();
            const duplicateStudent = isUniqueViolation(rowError, 'eventId,studentId');
            const duplicateCode = isUniqueViolation(rowError, 'verificationCode');

            issues.push({
              row: insertable[index].index + 1,
              universityCode: code,
              code: duplicateStudent
                ? 'ALREADY_REGISTERED'
                : duplicateCode
                  ? 'DUPLICATE_VERIFICATION_CODE'
                  : 'DB_ERROR',
              message: duplicateStudent
                ? `No se pudo registrar ${code}: el registro ya existe.`
                : duplicateCode
                  ? `No se pudo registrar ${code}: el codigo de verificacion ya esta asignado en este evento.`
                  : `No se pudo registrar ${code}: error de base de datos.`,
            });
          }
        }
      }
    }

    return registered;
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
      origin: row.origin,
      userCreate: row.userCreate,
      userUpdate: row.userUpdate,
      descriptionStatus: row.descriptionStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export type { ParticipationRow };

/**
 * Normaliza la nota recibida.
 *
 * Acepta un numero entre 0 y 20 (con punto o coma) o el texto "sin nota".
 * Si llega vacia, se guarda exactamente "sin nota".
 */
function normalizeGrade(value: string | null | undefined): string {
  const text = (value ?? '').trim();

  if (!text || text.toLowerCase() === 'sin nota') {
    return 'sin nota';
  }

  const numeric = Number(text.replace(',', '.'));

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 20) {
    throw new BadRequestException('La nota debe ser un numero entre 0 y 20 o "sin nota".');
  }

  return String(numeric);
}

/**
 * Lleva una fecha calendario a las 12:00 UTC.
 *
 * La fecha de participacion es un dia, no una marca de tiempo. Guardarla a
 * medianoche UTC hace que en zonas con offset negativo (Peru, UTC-5) se muestre
 * el dia anterior. El mediodia UTC conserva el dia en cualquier zona razonable.
 */
function toCalendarNoon(value: Date): Date {
  const date = new Date(value.getTime());
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

/** Nombre del autor con un respaldo para que nunca quede vacio. */
function authorName(actor: Actor): string {
  return actor.fullName?.trim() || 'Usuario 1';
}
