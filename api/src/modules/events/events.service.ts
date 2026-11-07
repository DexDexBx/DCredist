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
  EventDateType,
  EventModality,
  EventOrigin,
  EventStatus,
  EventType,
  UserRole,
} from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { isGeneralSchool } from '../../common/actor/actor.guard';
import { assertCanReadSchool } from '../../common/actor/school-scope';
import { BULK_INSERT_BATCH_SIZE, chunk } from '../../common/prisma/bulk';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventDto } from './dto/event.dto';
import {
  EventImportIssueDto,
  EventImportResultDto,
  ImportEventsDto,
} from './dto/import-events.dto';
import { EventParticipantDto, EventSummaryDto } from './dto/event-participant.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const eventInclude = {
  organizer: { select: { id: true, name: true } },
  professionalSchool: { select: { id: true, name: true } },
  eventTypeCatalog: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

const DAY_MS = 86_400_000;

const DEFAULT_DESCRIPTION = 'Sin descripción';
const DEFAULT_LOCATION = 'Sin ubicación';
const UNSPECIFIED_EVENT_TYPE_NAME = 'Unspecified';

/** Etiquetas en espanol -> valores de la base, para la importacion masiva. */
const MODALITY_BY_LABEL: Record<string, EventModality> = {
  presencial: EventModality.PRESENTIAL,
  virtual: EventModality.VIRTUAL,
  hibrido: EventModality.HYBRID,
  'no especificado': EventModality.UNSPECIFIED,
};

const STATUS_BY_LABEL: Record<string, EventStatus> = {
  programado: EventStatus.SCHEDULED,
  'en curso': EventStatus.IN_PROGRESS,
  finalizado: EventStatus.COMPLETED,
  cancelado: EventStatus.CANCELLED,
};

const EVENT_TYPE_BY_LABEL: Record<string, string> = {
  congreso: 'Congress',
  seminario: 'Seminar',
  taller: 'Workshop',
  curso: 'Course',
  foro: 'Forum',
  conferencia: 'Conference',
  webinar: 'Webinar',
  muestra: 'Exhibition',
  'no especificado': 'Unspecified',
};

/**
 * Secuencia de estados para usuarios que no son administradores.
 * Programado -> En curso | Cancelado; En curso -> Finalizado | Cancelado.
 * Finalizado y Cancelado son terminales.
 */
const EVENT_STATUS_TRANSITIONS: Partial<Record<EventStatus, readonly EventStatus[]>> = {
  [EventStatus.SCHEDULED]: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED],
  [EventStatus.IN_PROGRESS]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado con filtros opcionales.
   *
   * Un usuario de escuela solo ve los eventos de su escuela; una cuenta global
   * (`general`) ve todos. La escuela y el organizador viajan con id y nombre.
   */
  async findAll(query: QueryEventsDto, actor: Actor): Promise<EventDto[]> {
    const search = query.search?.trim();

    const rows = await this.prisma.event.findMany({
      where: {
        ...(actor.isGlobal ? {} : { professionalSchoolId: actor.professionalSchoolId }),
        ...(query.status ? { status: query.status } : {}),
        ...(query.eventTypeId ? { eventTypeId: query.eventTypeId } : {}),
        ...(query.professionalSchoolId
          ? { professionalSchoolId: query.professionalSchoolId }
          : {}),
        ...(query.organizerId ? { organizerId: query.organizerId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { eventTypeCatalog: { name: { contains: search, mode: 'insensitive' } } },
                { organizer: { name: { contains: search, mode: 'insensitive' } } },
                { professionalSchool: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: eventInclude,
      orderBy: { startDate: 'asc' },
    });

    return rows.map(toEventDto);
  }

  async findOne(id: number, actor: Actor): Promise<EventRow> {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: eventInclude,
    });

    if (!event) {
      throw new NotFoundException(`No existe un evento con id "${id}".`);
    }

    assertCanReadSchool(actor, event.professionalSchoolId);

    return event;
  }

  /** Detalle plano para el API. */
  async findOneDto(id: number, actor: Actor): Promise<EventDto> {
    return toEventDto(await this.findOne(id, actor));
  }

  /**
   * Estudiantes registrados en el evento.
   *
   * Por defecto incluye TODOS los estados para que la interfaz pueda mostrar
   * tambien las participaciones anuladas. Con `includeCancelled=false` se
   * limita a las vigentes, que es lo que necesita el reporte institucional.
   */
  async findParticipants(
    id: number,
    includeCancelled: boolean,
    actor: Actor
  ): Promise<EventParticipantDto[]> {
    await this.findOne(id, actor);

    const participations = await this.prisma.participation.findMany({
      where: {
        eventId: id,
        ...(includeCancelled ? {} : { status: { in: ['VALID', 'PENDING'] } }),
      },
      include: {
        student: {
          select: {
            universityCode: true,
            lastName: true,
            firstName: true,
            professionalSchoolId: true,
            professionalSchool: { select: { name: true } },
            locationId: true,
            location: { select: { name: true } },
          },
        },
      },
      orderBy: { student: { universityCode: 'asc' } },
    });

    return participations.map((participation) => ({
      participationId: participation.id,
      studentId: participation.studentId,
      universityCode: participation.student.universityCode,
      lastName: participation.student.lastName,
      firstName: participation.student.firstName,
      professionalSchoolId: participation.student.professionalSchoolId,
      professionalSchool: participation.student.professionalSchool.name,
      locationId: participation.student.locationId,
      location: participation.student.location.name,
      verificationCode: participation.verificationCode,
      credits: participation.credits,
      grade: participation.grade,
      status: participation.status,
      participationDate: participation.participationDate,
    }));
  }

  /** Evento mas su conteo de participaciones vigentes: lo que ocupa cupo. */
  async findSummary(id: number, actor: Actor): Promise<EventSummaryDto> {
    const event = await this.findOne(id, actor);
    const registeredCount = await this.countValidParticipations(id);

    return {
      id: event.id,
      code: event.code,
      name: event.name,
      eventTypeId: event.eventTypeCatalog.id,
      eventTypeName: event.eventTypeCatalog.name,
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
      registeredCount,
    };
  }

  async create(dto: CreateEventDto, actor: Actor): Promise<EventDto> {
    const origin = dto.origin ?? EventOrigin.CURRENT;
    const isHistorical = origin === EventOrigin.LEGACY;
    const dateType = dto.dateType ?? EventDateType.LONG;

    // Fechas obligatorias en ambos modos: completas (dia/mes/anio) o solo
    // mes/anio. En el segundo caso el dia se guarda como 29 en ambas columnas.
    let startDate: Date;
    let endDate: Date;

    if (dateType === EventDateType.SHORT) {
      if (!dto.startDate || !isMonthYear(dto.startDate)) {
        throw new BadRequestException(
          'Indica el mes y año del evento con el formato YYYY-MM.'
        );
      }
      startDate = monthYearToCalendarDate(dto.startDate);
      endDate = startDate;
    } else {
      if (!dto.startDate || !dto.endDate) {
        throw new BadRequestException('Las fechas de inicio y fin son obligatorias.');
      }
      if (!isFullDate(dto.startDate) || !isFullDate(dto.endDate)) {
        throw new BadRequestException(
          'La fecha completa debe incluir día, mes y año (YYYY-MM-DD).'
        );
      }
      startDate = toCalendarDate(dto.startDate);
      endDate = toCalendarDate(dto.endDate);
      this.assertDates(startDate, endDate);
    }
    await this.assertSchoolAssignable(dto.professionalSchoolId, actor);
    await this.assertOrganizerAssignable(dto.organizerId);

    // Tipo academico: en un registro actual es obligatorio; en uno historico
    // cae al tipo "No especificado" del catalogo.
    let eventTypeId: number;
    if (dto.eventTypeId) {
      await this.assertEventTypeAssignable(dto.eventTypeId);
      eventTypeId = dto.eventTypeId;
    } else if (isHistorical) {
      eventTypeId = await this.resolveUnspecifiedEventTypeId();
    } else {
      throw new BadRequestException('El tipo de evento es obligatorio en un registro actual.');
    }

    if (dto.capacity !== undefined && dto.capacity !== null && dto.capacity < 0) {
      throw new BadRequestException('La capacidad no puede ser negativa.');
    }

    if (
      dto.credits !== undefined &&
      dto.credits !== null &&
      (dto.credits < 0 || dto.credits > 21)
    ) {
      throw new BadRequestException('Los créditos del evento deben estar entre 0 y 21.');
    }

    const rawDescription = dto.description?.trim() ?? '';
    const rawLocation = dto.location?.trim() ?? '';

    if (!isHistorical) {
      if (!rawDescription) {
        throw new BadRequestException(
          'La descripción es obligatoria en un registro actual.'
        );
      }
      if (!rawLocation) {
        throw new BadRequestException(
          'La ubicación o enlace es obligatorio en un registro actual.'
        );
      }
      if (dto.capacity === undefined || dto.capacity === null) {
        throw new BadRequestException(
          'La capacidad es obligatoria en un registro actual (0 = sin límite).'
        );
      }
    }

    const description = rawDescription || DEFAULT_DESCRIPTION;
    const location = rawLocation || DEFAULT_LOCATION;
    const modality = dto.modality ?? (isHistorical ? EventModality.UNSPECIFIED : EventModality.PRESENTIAL);
    const status = dto.status ?? (isHistorical ? EventStatus.COMPLETED : EventStatus.SCHEDULED);

    // El codigo mantiene la secuencia EVT-AAAA-NNN. Para los historicos se usa el
    // anio actual, no la fecha sentinela de 1999.
    const codeDate = isHistorical ? new Date() : startDate;
    const code = dto.code?.trim() || (await this.generateCode(codeDate));

    if (dto.code?.trim()) {
      const existing = await this.prisma.event.findUnique({ where: { code } });

      if (existing) {
        throw new ConflictException(`Ya existe un evento con el código "${code}".`);
      }
    }

    try {
      const created = await this.prisma.event.create({
        data: {
          code,
          name: dto.name.trim(),
          description,
          eventTypeId,
          // La duracion no se elige: se deriva de las fechas.
          durationType: dto.durationType ?? this.deriveDurationType(startDate, endDate),
          startDate,
          endDate,
          dateType,
          modality,
          location,
          origin,
          // 0 = sin limite. No se guardan capacidades nulas.
          capacity: dto.capacity ?? 0,
          organizerId: dto.organizerId,
          professionalSchoolId: dto.professionalSchoolId,
          credits: dto.credits ?? 1,
          status,
          // Sello de autoria: el backend usa el actor de la peticion.
          userCreate: actor.fullName,
          userUpdate: actor.fullName,
        },
        include: eventInclude,
      });

      return toEventDto(created);
    } catch (error) {
      if (isUniqueViolation(error, 'code')) {
        throw new ConflictException(`Ya existe un evento con el código "${code}".`);
      }
      this.logger.error('No se pudo crear el evento.', error);
      throw error;
    }
  }

  /**
   * Elimina un evento.
   *
   * Reglas:
   *  - solo el rol ADMIN puede hacerlo,
   *  - se bloquea si el evento tiene CUALQUIER participacion (aunque este anulada),
   *  - el alcance por escuela se valida igual que en la lectura.
   */
  async remove(id: number, actor: Actor): Promise<{ deleted: boolean }> {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Solo un administrador puede eliminar eventos.');
    }

    const event = await this.findOne(id, actor);

    const participations = await this.prisma.participation.count({
      where: { eventId: id },
    });

    if (participations > 0) {
      throw new ConflictException(
        `No se puede eliminar el evento ${event.code}: tiene ${participations} participación(es) asociada(s).`
      );
    }

    await this.prisma.event.delete({ where: { id } });
    return { deleted: true };
  }

  async update(id: number, dto: UpdateEventDto, actor: Actor): Promise<EventDto> {
    const current = await this.findOne(id, actor);

    // Solo el administrador puede modificar un evento que ya tiene estudiantes
    // asociados: cambiar sus datos afectaria participaciones y certificados.
    const participationCount = await this.prisma.participation.count({
      where: { eventId: id },
    });

    if (participationCount > 0 && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'No puedes editar este evento porque tiene estudiantes asociados. Contacta con el administrador.'
      );
    }

    // El estado solo avanza en la secuencia establecida; el administrador puede
    // corregirlo libremente.
    if (
      dto.status !== undefined &&
      dto.status !== current.status &&
      actor.role !== UserRole.ADMIN
    ) {
      const allowed = EVENT_STATUS_TRANSITIONS[current.status] ?? [];

      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `No puedes cambiar el estado de "${current.status}" a "${dto.status}".`
        );
      }
    }

    if (current.origin !== EventOrigin.LEGACY) {
      if (dto.description !== undefined && !dto.description.trim()) {
        throw new BadRequestException(
          'La descripción es obligatoria en un registro actual.'
        );
      }
      if (dto.location !== undefined && !dto.location.trim()) {
        throw new BadRequestException(
          'La ubicación o enlace es obligatorio en un registro actual.'
        );
      }
    }

    const dateType = dto.dateType ?? current.dateType ?? EventDateType.LONG;

    let startDate: Date;
    let endDate: Date;

    if (dateType === EventDateType.SHORT) {
      if (dto.startDate !== undefined) {
        if (!isMonthYear(dto.startDate)) {
          throw new BadRequestException(
            'La fecha incompleta debe tener solo mes y año (YYYY-MM).'
          );
        }
        startDate = monthYearToCalendarDate(dto.startDate);
        endDate = startDate;
      } else if (dto.dateType === EventDateType.SHORT) {
        startDate = monthYearToCalendarDate(formatMonthYear(current.startDate));
        endDate = startDate;
      } else {
        startDate = current.startDate;
        endDate = current.endDate;
      }
    } else {
      if (dto.startDate !== undefined && !isFullDate(dto.startDate)) {
        throw new BadRequestException(
          'La fecha de inicio completa debe incluir día, mes y año (YYYY-MM-DD).'
        );
      }
      if (dto.endDate !== undefined && !isFullDate(dto.endDate)) {
        throw new BadRequestException(
          'La fecha de fin debe incluir día, mes y año (YYYY-MM-DD).'
        );
      }

      startDate = dto.startDate ? toCalendarDate(dto.startDate) : current.startDate;
      endDate = dto.endDate ? toCalendarDate(dto.endDate) : current.endDate;
      this.assertDates(startDate, endDate);
    }

    if (dto.capacity !== undefined && dto.capacity !== null && dto.capacity < 0) {
      throw new BadRequestException('La capacidad no puede ser negativa.');
    }

    if (
      dto.credits !== undefined &&
      dto.credits !== null &&
      (dto.credits < 0 || dto.credits > 21)
    ) {
      throw new BadRequestException('Los créditos del evento deben estar entre 0 y 21.');
    }

    if (dto.professionalSchoolId !== undefined) {
      await this.assertSchoolAssignable(dto.professionalSchoolId, actor);

      if (
        dto.professionalSchoolId !== current.professionalSchoolId &&
        (await this.prisma.participation.count({ where: { eventId: id } })) > 0
      ) {
        throw new ConflictException(
          'No se puede cambiar la escuela de un evento que ya tiene participaciones registradas.'
        );
      }
    }

    if (dto.organizerId !== undefined) {
      await this.assertOrganizerAssignable(dto.organizerId);
    }

    if (dto.eventTypeId !== undefined) {
      await this.assertEventTypeAssignable(dto.eventTypeId);
    }

    if (dto.code?.trim() && dto.code.trim() !== current.code) {
      const taken = await this.prisma.event.findUnique({ where: { code: dto.code.trim() } });

      if (taken) {
        throw new ConflictException(`Ya existe un evento con el código "${dto.code.trim()}".`);
      }
    }

    // Si cambia el dia de inicio, las participaciones que heredaron la fecha
    // del evento deben reflejar la correccion. Solo se tocan las que estaban en
    // el dia anterior del evento: una fecha personalizada no se pisa.
    const startDayChanged =
      dto.startDate !== undefined &&
      startOfUtcDay(startDate).getTime() !== startOfUtcDay(current.startDate).getTime();

    // Los creditos del evento son la fuente de verdad: si cambian, las
    // participaciones ya registradas deben reflejar el mismo valor. Sin esto,
    // los totales del estudiante y del dashboard seguian sumando los creditos
    // antiguos guardados en cada participacion.
    const nextCredits = dto.credits ?? 1;
    const creditsChanged = dto.credits !== undefined && nextCredits !== current.credits;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.update({
          where: { id },
          data: {
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || DEFAULT_DESCRIPTION }
            : {}),
          ...(dto.eventTypeId !== undefined ? { eventTypeId: dto.eventTypeId } : {}),
          ...(dto.durationType !== undefined
            ? { durationType: dto.durationType }
            : { durationType: this.deriveDurationType(startDate, endDate) }),
          startDate,
          endDate,
          dateType,
          ...(dto.modality !== undefined ? { modality: dto.modality } : {}),
          ...(dto.location !== undefined
            ? { location: dto.location.trim() || DEFAULT_LOCATION }
            : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity ?? 0 } : {}),
          ...(dto.organizerId !== undefined ? { organizerId: dto.organizerId } : {}),
          ...(dto.professionalSchoolId !== undefined
            ? { professionalSchoolId: dto.professionalSchoolId }
            : {}),
          ...(dto.credits !== undefined ? { credits: dto.credits ?? 1 } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
            // Cada modificacion actualiza quien la hizo; userCreate no se toca.
            userUpdate: actor.fullName,
          },
          include: eventInclude,
        });

        if (startDayChanged) {
          await tx.participation.updateMany({
            where: {
              eventId: id,
              participationDate: {
                gte: startOfUtcDay(current.startDate),
                lt: new Date(startOfUtcDay(current.startDate).getTime() + DAY_MS),
              },
            },
            data: { participationDate: startDate },
          });
        }

        if (creditsChanged) {
          await tx.participation.updateMany({
            where: { eventId: id },
            data: { credits: nextCredits },
          });
        }

        return event;
      });

      return toEventDto(updated);
    } catch (error) {
      if (isUniqueViolation(error, 'code')) {
        throw new ConflictException(`Ya existe un evento con el código "${dto.code?.trim()}".`);
      }
      this.logger.error(`No se pudo actualizar el evento "${id}".`, error);
      throw error;
    }
  }

  /**
   * CARGA MASIVA DE EVENTOS (actuales o historicos).
   *
   * Resuelve escuela, organizador y tipo de evento por nombre. Respeta la regla
   * de creacion: una cuenta global puede cargar cualquier escuela real; una de
   * escuela solo la suya. El codigo se genera con la misma secuencia EVT-AAAA-NNN.
   */
  async importEvents(dto: ImportEventsDto, actor: Actor): Promise<EventImportResultDto> {
    const origin = dto.origin ?? EventOrigin.CURRENT;
    const isHistorical = origin === EventOrigin.LEGACY;
    const defaultDateType = dto.dateType ?? EventDateType.LONG;
    const issues: EventImportIssueDto[] = [];

    const [schools, organizers, eventTypes] = await Promise.all([
      this.prisma.professionalSchool.findMany({
        select: { id: true, name: true, status: true },
      }),
      this.prisma.organizer.findMany({
        select: { id: true, name: true, status: true },
      }),
      this.prisma.eventTypeCatalog.findMany({
        select: { id: true, name: true, status: true },
      }),
    ]);

    const schoolByName = new Map(schools.map((row) => [normalizeLookup(row.name), row]));
    const organizerByName = new Map(organizers.map((row) => [normalizeLookup(row.name), row]));
    const eventTypeByName = new Map(eventTypes.map((row) => [normalizeLookup(row.name), row]));

    // Codigos ocupados: se leen una vez para continuar la secuencia sin chocar.
    const existingCodes = await this.prisma.event.findMany({
      where: { code: { startsWith: 'EVT-' } },
      select: { code: true },
    });
    const takenCodes = new Set(existingCodes.map((row) => row.code));
    const maxSeqByYear = new Map<number, number>();
    for (const code of takenCodes) {
      const match = /^EVT-(\d{4})-(\d{3,})$/.exec(code);
      if (match) {
        const year = Number(match[1]);
        const seq = Number(match[2]);
        maxSeqByYear.set(year, Math.max(maxSeqByYear.get(year) ?? 0, seq));
      }
    }

    const data: Prisma.EventCreateManyInput[] = [];
    let skipped = 0;

    for (let index = 0; index < dto.rows.length; index++) {
      const row = dto.rows[index];
      const line = index + 1;
      const name = row.name?.trim() ?? '';

      if (!name) {
        issues.push({ row: line, name: '', code: 'MISSING_NAME', message: 'La fila no tiene nombre de evento.' });
        skipped++;
        continue;
      }

      // Tipo de fecha por fila. El registro actual siempre es fecha completa.
      if (isHistorical && !row.dateType) {
        issues.push({
          row: line,
          name,
          code: 'MISSING_DATE_TYPE',
          message: 'Falta el tipo de fecha: indica "Fecha completa" o "Solo mes y año".',
        });
        skipped++;
        continue;
      }

      const rowDateType: EventDateType = isHistorical
        ? (row.dateType ?? defaultDateType)
        : EventDateType.LONG;

      // Fechas
      let startDate: Date;
      let endDate: Date;

      if (rowDateType === EventDateType.SHORT) {
        if (!row.startDate || !isMonthYear(row.startDate)) {
          issues.push({ row: line, name, code: 'MISSING_DATES', message: 'Indica el mes y año de inicio (YYYY-MM).' });
          skipped++;
          continue;
        }
        startDate = monthYearToCalendarDate(row.startDate);
        endDate = startDate;
      } else {
        if (!row.startDate || !row.endDate) {
          issues.push({ row: line, name, code: 'MISSING_DATES', message: 'Faltan las fechas de inicio y fin.' });
          skipped++;
          continue;
        }
        if (!isFullDate(row.startDate) || !isFullDate(row.endDate)) {
          issues.push({ row: line, name, code: 'INVALID_ROW', message: 'Las fechas completas deben usar YYYY-MM-DD.' });
          skipped++;
          continue;
        }
        startDate = toCalendarDate(row.startDate);
        endDate = toCalendarDate(row.endDate);
      }

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() < startDate.getTime()) {
        issues.push({ row: line, name, code: 'INVALID_ROW', message: 'Fechas invalidas: endDate debe ser >= startDate.' });
        skipped++;
        continue;
      }

      // Organizador
      const organizer = organizerByName.get(normalizeLookup(row.organizer));
      if (!organizer || organizer.status !== CatalogStatus.ACTIVE) {
        issues.push({ row: line, name, code: 'UNKNOWN_ORGANIZER', message: `El organizador "${row.organizer}" no existe o esta inactivo.` });
        skipped++;
        continue;
      }

      // Escuela
      const school = schoolByName.get(normalizeLookup(row.professionalSchool));
      if (!school || school.status !== CatalogStatus.ACTIVE) {
        issues.push({ row: line, name, code: 'UNKNOWN_SCHOOL', message: `La escuela "${row.professionalSchool}" no existe o esta inactiva.` });
        skipped++;
        continue;
      }
      if (isGeneralSchool(school.name)) {
        issues.push({ row: line, name, code: 'INVALID_ROW', message: 'La escuela "general" no puede ser duena de un evento.' });
        skipped++;
        continue;
      }
      if (!actor.isGlobal && school.id !== actor.professionalSchoolId) {
        issues.push({ row: line, name, code: 'FOREIGN_SCHOOL', message: `Solo puedes cargar eventos de tu escuela (${actor.professionalSchoolName}).` });
        skipped++;
        continue;
      }

      // Tipo de evento
      let eventTypeId: number;
      if (row.eventType?.trim()) {
        const resolved = this.resolveImportedEventTypeId(row.eventType, eventTypeByName);
        if (!resolved) {
          issues.push({ row: line, name, code: 'UNKNOWN_EVENT_TYPE', message: `El tipo de evento "${row.eventType}" no existe.` });
          skipped++;
          continue;
        }
        eventTypeId = resolved;
      } else {
        issues.push({ row: line, name, code: 'MISSING_EVENT_TYPE', message: 'Falta el tipo de evento.' });
        skipped++;
        continue;
      }

      // Modalidad
      let modality: EventModality;
      if (row.modality?.trim()) {
        const resolved = MODALITY_BY_LABEL[normalizeLookup(row.modality)];
        if (!resolved) {
          issues.push({ row: line, name, code: 'INVALID_ROW', message: `La modalidad "${row.modality}" no es valida.` });
          skipped++;
          continue;
        }
        modality = resolved;
      } else {
        issues.push({ row: line, name, code: 'MISSING_MODALITY', message: 'Falta la modalidad.' });
        skipped++;
        continue;
      }

      // Estado
      let status: EventStatus;
      if (row.status?.trim()) {
        const resolved = STATUS_BY_LABEL[normalizeLookup(row.status)];
        if (!resolved) {
          issues.push({ row: line, name, code: 'INVALID_ROW', message: `El estado "${row.status}" no es valido.` });
          skipped++;
          continue;
        }
        status = resolved;
      } else {
        issues.push({ row: line, name, code: 'MISSING_STATUS', message: 'Falta el estado.' });
        skipped++;
        continue;
      }

      const rawDescription = row.description?.trim() ?? '';
      const rawLocation = row.location?.trim() ?? '';

      if (!isHistorical) {
        if (!rawDescription) {
          issues.push({ row: line, name, code: 'MISSING_DESCRIPTION', message: 'Falta la descripcion: obligatoria en un registro actual.' });
          skipped++;
          continue;
        }
        if (!rawLocation) {
          issues.push({ row: line, name, code: 'MISSING_LOCATION', message: 'Falta la ubicacion: obligatoria en un registro actual.' });
          skipped++;
          continue;
        }
      }

      if (row.capacity === undefined || row.capacity === null) {
        issues.push({ row: line, name, code: 'MISSING_CAPACITY', message: 'Falta la capacidad (0 = sin limite).' });
        skipped++;
        continue;
      }

      const description = rawDescription || DEFAULT_DESCRIPTION;
      if (rawDescription && rawDescription.length < 3) {
        issues.push({ row: line, name, code: 'INVALID_ROW', message: 'La descripcion debe tener al menos 3 caracteres.' });
        skipped++;
        continue;
      }

      // Los creditos son obligatorios en ambas cargas.
      if (row.credits === undefined || row.credits === null) {
        issues.push({ row: line, name, code: 'MISSING_CREDITS', message: 'Falta el numero de creditos: es obligatorio.' });
        skipped++;
        continue;
      }

      if (row.credits < 0 || row.credits > 21 || !Number.isFinite(row.credits)) {
        issues.push({ row: line, name, code: 'INVALID_ROW', message: 'Los creditos deben ser un numero entre 0 y 21.' });
        skipped++;
        continue;
      }

      // Codigo (se genera si se omite)
      let code = row.code?.trim();
      if (code) {
        if (takenCodes.has(code)) {
          issues.push({ row: line, name, code: 'DUPLICATE_CODE', message: `Ya existe un evento con el codigo "${code}".` });
          skipped++;
          continue;
        }
        takenCodes.add(code);
      } else {
        const year = isHistorical ? new Date().getFullYear() : startDate.getFullYear();
        let seq = (maxSeqByYear.get(year) ?? 0) + 1;
        let candidate = `EVT-${year}-${String(seq).padStart(3, '0')}`;
        while (takenCodes.has(candidate)) {
          seq++;
          candidate = `EVT-${year}-${String(seq).padStart(3, '0')}`;
        }
        maxSeqByYear.set(year, seq);
        takenCodes.add(candidate);
        code = candidate;
      }

      data.push({
        code,
        name,
        description,
        eventTypeId,
        durationType: this.deriveDurationType(startDate, endDate),
        startDate,
        endDate,
        dateType: rowDateType,
        modality,
        location: row.location?.trim() || DEFAULT_LOCATION,
        origin,
        capacity: row.capacity ?? 0,
        organizerId: organizer.id,
        professionalSchoolId: school.id,
        credits: row.credits,
        status,
        userCreate: actor.fullName,
        userUpdate: actor.fullName,
      });
    }

    let registered = 0;

    for (let start = 0; start < data.length; start += BULK_INSERT_BATCH_SIZE) {
      const batch = data.slice(start, start + BULK_INSERT_BATCH_SIZE);

      try {
        const result = await this.prisma.event.createMany({ data: batch });
        registered += result.count;
      } catch (error) {
        this.logger.warn('La carga por lotes de eventos fallo; se reintenta fila a fila.', error);

        for (const item of batch) {
          try {
            await this.prisma.event.create({ data: item });
            registered++;
          } catch (rowError) {
            skipped++;
            const duplicate = isUniqueViolation(rowError, 'code');
            const detail =
              rowError instanceof Error && rowError.message
                ? rowError.message.slice(0, 240)
                : 'error de base de datos';
            issues.push({
              row: 0,
              name: item.name,
              code: duplicate ? 'DUPLICATE_CODE' : 'DB_ERROR',
              message: duplicate
                ? `Ya existe un evento con el codigo "${item.code}".`
                : `No se pudo registrar el evento: ${detail}`,
            });
          }
        }
      }
    }

    issues.sort((a, b) => a.row - b.row);

    return {
      total: dto.rows.length,
      registered,
      skipped,
      issues,
    };
  }

  /** Resuelve el id de un tipo de evento a partir de su etiqueta o nombre. */
  private resolveImportedEventTypeId(
    input: string,
    eventTypeByName: Map<string, { id: number; status: CatalogStatus }>
  ): number | undefined {
    const key = normalizeLookup(input);
    const english = EVENT_TYPE_BY_LABEL[key] ?? key;
    const row = eventTypeByName.get(normalizeLookup(english));
    return row && row.status === CatalogStatus.ACTIVE ? row.id : undefined;
  }

  /** Participaciones vigentes: las unicas que ocupan cupo y otorgan creditos. */
  async countValidParticipations(eventId: number): Promise<number> {
    return this.prisma.participation.count({
      where: { eventId, status: 'VALID' },
    });
  }

  private assertDates(startDate: Date, endDate: Date): void {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Las fechas del evento no son válidas.');
    }

    // Unica regla temporal: el fin no puede ser anterior al inicio.
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'La fecha de término (endDate) no puede ser anterior a la de inicio (startDate).'
      );
    }
  }

  /**
   * Una cuenta global puede crear eventos de cualquier escuela real; una cuenta
   * de escuela solo de la suya. `general` nunca es una escuela de eventos.
   */
  private async assertSchoolAssignable(
    schoolId: number,
    actor: Actor
  ): Promise<void> {
    const school = await this.prisma.professionalSchool.findUnique({
      where: { id: schoolId },
      select: { name: true, status: true },
    });

    if (!school || school.status !== CatalogStatus.ACTIVE) {
      throw new BadRequestException('La escuela profesional no existe o esta inactiva.');
    }

    if (isGeneralSchool(school.name)) {
      throw new BadRequestException(
        'La escuela "general" no puede ser duena de un evento: no es una escuela real.'
      );
    }

    if (!actor.isGlobal && schoolId !== actor.professionalSchoolId) {
      throw new ForbiddenException('Solo puedes operar eventos de tu propia escuela.');
    }
  }

  private async assertOrganizerAssignable(organizerId: number): Promise<void> {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      select: { status: true },
    });

    if (!organizer || organizer.status !== CatalogStatus.ACTIVE) {
      throw new BadRequestException('El organizador no existe o esta inactivo.');
    }
  }

  private async assertEventTypeAssignable(eventTypeId: number): Promise<void> {
    const eventType = await this.prisma.eventTypeCatalog.findUnique({
      where: { id: eventTypeId },
      select: { status: true },
    });

    if (!eventType || eventType.status !== CatalogStatus.ACTIVE) {
      throw new BadRequestException('El tipo de evento no existe o esta inactivo.');
    }
  }

  /**
   * Id del tipo "No especificado" usado por los registros historicos.
   *
   * Se crea si no existe: asi la carga historica no depende de que una
   * migracion previa haya insertado el catalogo.
   */
  private async resolveUnspecifiedEventTypeId(): Promise<number> {
    const row = await this.prisma.eventTypeCatalog.upsert({
      where: { name: UNSPECIFIED_EVENT_TYPE_NAME },
      update: {},
      create: {
        name: UNSPECIFIED_EVENT_TYPE_NAME,
        status: CatalogStatus.ACTIVE,
      },
      select: { id: true },
    });

    return row.id;
  }

  private deriveDurationType(startDate: Date, endDate: Date): EventType {
    return endDate.getTime() - startDate.getTime() >= DAY_MS
      ? EventType.MULTI_DAY
      : EventType.SINGLE_DAY;
  }

  /** EVT-AAAA-NNN, correlativo por anio, sin depender de una secuencia global. */
  private async generateCode(startDate: Date): Promise<string> {
    const year = startDate.getFullYear();
    const prefix = `EVT-${year}-`;
    const total = await this.prisma.event.count({
      where: { code: { startsWith: prefix } },
    });

    let sequence = total + 1;

    // Evita chocar con un codigo existente si la correlacion se desincroniza.
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = `${prefix}${String(sequence).padStart(3, '0')}`;
      const taken = await this.prisma.event.count({ where: { code: candidate } });

      if (taken === 0) {
        return candidate;
      }
      sequence++;
    }

    throw new ConflictException(
      'No se pudo generar un código de evento libre. Registra el código manualmente.'
    );
  }
}

/** Aplana la escuela y el organizador al contrato que consume el frontend. */
function toEventDto(row: EventRow): EventDto {
  const { organizer, professionalSchool, eventTypeCatalog, ...event } = row;

  return {
    ...event,
    organizerId: organizer.id,
    organizer: organizer.name,
    professionalSchoolId: professionalSchool.id,
    professionalSchool: professionalSchool.name,
    eventTypeId: eventTypeCatalog.id,
    eventTypeName: eventTypeCatalog.name,
  };
}

/** Medianoche UTC del dia de una fecha calendario. */
function startOfUtcDay(value: Date): Date {
  const date = new Date(value.getTime());
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

/** Normaliza una etiqueta para compararla: minusculas y sin tildes. */
function normalizeLookup(value: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function isMonthYear(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value.trim());
}

function isFullDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** "YYYY-MM" -> dia 29 del mes, a mediodia UTC. */
function monthYearToCalendarDate(value: string): Date {
  return toCalendarDate(`${value.trim()}-29`);
}

/** Fecha UTC -> "YYYY-MM". */
function formatMonthYear(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Convierte una fecha calendario a un Date a mediodia UTC.
 *
 * Las columnas son DATE (sin hora). Guardar medianoche UTC haria que, en zonas
 * con offset negativo (Peru, UTC-5), PostgreSQL registre el dia anterior. El
 * mediodia UTC conserva el dia en cualquier zona razonable.
 */
function toCalendarDate(value: string): Date {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? new Date(`${match[1]}T12:00:00.000Z`) : new Date(value);
}
