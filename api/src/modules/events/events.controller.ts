import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { EventDto } from './dto/event.dto';
import { EventParticipantDto, EventSummaryDto } from './dto/event-participant.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los eventos ordenados por fecha de inicio.',
    description: 'Un usuario de escuela solo ve los eventos de su escuela.',
  })
  @ApiOkResponse({ type: [EventDto] })
  findAll(
    @Query() query: QueryEventsDto,
    @CurrentActor() actor: Actor
  ): Promise<EventDto[]> {
    return this.eventsService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un evento.' })
  @ApiOkResponse({ type: EventDto })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: Actor): Promise<EventDto> {
    return this.eventsService.findOneDto(id, actor);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Evento con su conteo de participantes vigentes.',
    description: 'registeredCount es lo que ocupa cupo: solo participaciones VALID.',
  })
  @ApiOkResponse({ type: EventSummaryDto })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findSummary(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<EventSummaryDto> {
    return this.eventsService.findSummary(id, actor);
  }

  @Get(':id/participations')
  @ApiOperation({
    summary: 'Participaciones del evento con los datos del estudiante.',
    description:
      'Datos preparados para la revision de participantes y el exporte institucional: codigo, grado, apellidos, nombres, escuela, sede, tipo, codigo DCredits, creditos, nota y estado.',
  })
  @ApiQuery({
    name: 'includeCancelled',
    required: false,
    description: 'false excluye las participaciones anuladas.',
  })
  @ApiOkResponse({ type: [EventParticipantDto] })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findParticipants(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeCancelled') includeCancelled: string | undefined,
    @CurrentActor() actor: Actor
  ): Promise<EventParticipantDto[]> {
    return this.eventsService.findParticipants(id, includeCancelled !== 'false', actor);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra un evento.',
    description:
      'Valida endDate >= startDate y credits >= 0. El codigo y el tipo de duracion (SINGLE_DAY/MULTI_DAY) se generan en el servidor cuando se omiten. Un usuario de escuela solo crea eventos de su escuela.',
  })
  @ApiCreatedResponse({ type: EventDto })
  @ApiBadRequestResponse({ description: 'Fechas, categoria, organizador o creditos invalidos.' })
  @ApiConflictResponse({ description: 'El codigo del evento ya existe.' })
  create(@Body() dto: CreateEventDto, @CurrentActor() actor: Actor): Promise<EventDto> {
    return this.eventsService.create(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita un evento.', description: 'Solo se actualizan los campos enviados.' })
  @ApiOkResponse({ type: EventDto })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  @ApiBadRequestResponse({ description: 'Fechas o creditos invalidos.' })
  @ApiConflictResponse({ description: 'El codigo del evento ya existe.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
    @CurrentActor() actor: Actor
  ): Promise<EventDto> {
    return this.eventsService.update(id, dto, actor);
  }
}
