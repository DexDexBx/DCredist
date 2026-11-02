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
  EventStatus,
  EventType,
} from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { isGeneralSchool } from '../../common/actor/actor.guard';
import { assertCanReadSchool } from '../../common/actor/school-scope';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { EventDto } from './dto/event.dto';
import { EventParticipantDto, EventSummaryDto } from './dto/event-participant.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const eventInclude = {
  organizer: { select: { id: true, name: true } },
  professionalSchool: { select: { id: true, name: true } },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

const DAY_MS = 86_400_000;

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
        ...(query.category ? { category: query.category } : {}),
        ...(query.professionalSchoolId
          ? { professionalSchoolId: query.professionalSchoolId }
          : {}),
        ...(query.organizerId ? { organizerId: query.organizerId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { category: { contains: search, mode: 'insensitive' } },
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

  async findOne(id: string, actor: Actor): Promise<EventRow> {
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
  async findOneDto(id: string, actor: Actor): Promise<EventDto> {
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
    id: string,
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
            academicDegree: true,
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
      academicDegree: participation.student.academicDegree,
      lastName: participation.student.lastName,
      firstName: participation.student.firstName,
      professionalSchoolId: participation.student.professionalSchoolId,
      professionalSchool: participation.student.professionalSchool.name,
      locationId: participation.student.locationId,
      location: participation.student.location.name,
      participationType: participation.participationType,
      verificationCode: participation.verificationCode,
      credits: participation.credits,
      grade: participation.grade,
      status: participation.status,
      participationDate: participation.participationDate,
    }));
  }

  /** Evento mas su conteo de participaciones vigentes: lo que ocupa cupo. */
  async findSummary(id: string, actor: Actor): Promise<EventSummaryDto> {
    const event = await this.findOne(id, actor);
    const registeredCount = await this.countValidParticipations(id);

    return {
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
      registeredCount,
    };
  }

  async create(dto: CreateEventDto, actor: Actor): Promise<EventDto> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    this.assertDates(startDate, endDate);
    await this.assertSchoolAssignable(dto.professionalSchoolId, actor);
    await this.assertOrganizerAssignable(dto.organizerId);

    if (dto.capacity !== undefined && dto.capacity !== null && dto.capacity < 0) {
      throw new BadRequestException('La capacidad no puede ser negativa.');
    }

    if (dto.credits !== undefined && dto.credits !== null && dto.credits < 0) {
      throw new BadRequestException('Los créditos del evento no pueden ser negativos.');
    }

    const code = dto.code?.trim() || (await this.generateCode(startDate));

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
          description: dto.description?.trim() ?? '',
          category: dto.category ?? 'Congreso',
          // La duracion no se elige: se deriva de las fechas.
          eventType: dto.eventType ?? this.deriveEventType(startDate, endDate),
          startDate,
          endDate,
          startTime: dto.startTime ?? null,
          endTime: dto.endTime ?? null,
          modality: dto.modality,
          location: dto.location?.trim() ?? '',
          capacity: dto.capacity ?? null,
          organizerId: dto.organizerId,
          professionalSchoolId: dto.professionalSchoolId,
          credits: dto.credits ?? 0,
          status: dto.status ?? EventStatus.SCHEDULED,
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

  async update(id: string, dto: UpdateEventDto, actor: Actor): Promise<EventDto> {
    const current = await this.findOne(id, actor);

    const startDate = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : current.endDate;

    this.assertDates(startDate, endDate);

    if (dto.capacity !== undefined && dto.capacity !== null && dto.capacity < 0) {
      throw new BadRequestException('La capacidad no puede ser negativa.');
    }

    if (dto.credits !== undefined && dto.credits !== null && dto.credits < 0) {
      throw new BadRequestException('Los créditos del evento no pueden ser negativos.');
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

    if (dto.code?.trim() && dto.code.trim() !== current.code) {
      const taken = await this.prisma.event.findUnique({ where: { code: dto.code.trim() } });

      if (taken) {
        throw new ConflictException(`Ya existe un evento con el código "${dto.code.trim()}".`);
      }
    }

    try {
      const updated = await this.prisma.event.update({
        where: { id },
        data: {
          ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.eventType !== undefined
            ? { eventType: dto.eventType }
            : { eventType: this.deriveEventType(startDate, endDate) }),
          startDate,
          endDate,
          ...(dto.startTime !== undefined ? { startTime: dto.startTime } : {}),
          ...(dto.endTime !== undefined ? { endTime: dto.endTime } : {}),
          ...(dto.modality !== undefined ? { modality: dto.modality } : {}),
          ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
          ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
          ...(dto.organizerId !== undefined ? { organizerId: dto.organizerId } : {}),
          ...(dto.professionalSchoolId !== undefined
            ? { professionalSchoolId: dto.professionalSchoolId }
            : {}),
          ...(dto.credits !== undefined ? { credits: dto.credits } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: eventInclude,
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

  /** Participaciones vigentes: las unicas que ocupan cupo y otorgan creditos. */
  async countValidParticipations(eventId: string): Promise<number> {
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

  private deriveEventType(startDate: Date, endDate: Date): EventType {
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
  const { organizer, professionalSchool, ...event } = row;

  return {
    ...event,
    organizerId: organizer.id,
    organizer: organizer.name,
    professionalSchoolId: professionalSchool.id,
    professionalSchool: professionalSchool.name,
  };
}
