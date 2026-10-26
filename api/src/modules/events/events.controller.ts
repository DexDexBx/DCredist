import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
import { CreateEventDto } from './dto/create-event.dto';
import { EventParticipantDto, EventSummaryDto } from './dto/event-participant.dto';
import { QueryEventsDto } from './dto/query-events.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los eventos ordenados por fecha de inicio.' })
  @ApiOkResponse({ description: 'Eventos academicos.' })
  findAll(@Query() query: QueryEventsDto) {
    return this.eventsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un evento.' })
  @ApiOkResponse({ description: 'Evento academico.' })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Evento con su conteo de participantes vigentes.',
    description: 'registeredCount es lo que ocupa cupo: solo participaciones VALID.',
  })
  @ApiOkResponse({ type: EventSummaryDto })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findSummary(@Param('id') id: string): Promise<EventSummaryDto> {
    return this.eventsService.findSummary(id);
  }

  @Get(':id/participations')
  @ApiOperation({
    summary: 'Participaciones del evento con los datos del estudiante.',
    description:
      'Datos preparados para la revision de participantes y el exporte institucional: codigo, grado, apellidos, nombres, escuela, sede, tipo, codigo DCredits, certificado, creditos, nota y estado.',
  })
  @ApiQuery({
    name: 'includeCancelled',
    required: false,
    description: 'false excluye las participaciones anuladas.',
  })
  @ApiOkResponse({ type: [EventParticipantDto] })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  findParticipants(
    @Param('id') id: string,
    @Query('includeCancelled') includeCancelled?: string
  ): Promise<EventParticipantDto[]> {
    return this.eventsService.findParticipants(id, includeCancelled !== 'false');
  }

  @Post()
  @ApiOperation({
    summary: 'Registra un evento.',
    description:
      'Valida endDate >= startDate y credits >= 0. El codigo y el tipo de duracion (SINGLE_DAY/MULTI_DAY) se generan en el servidor cuando se omiten.',
  })
  @ApiCreatedResponse({ description: 'Evento creado.' })
  @ApiBadRequestResponse({ description: 'Fechas, categoria o creditos invalidos.' })
  @ApiConflictResponse({ description: 'El codigo del evento ya existe.' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita un evento.', description: 'Solo se actualizan los campos enviados.' })
  @ApiOkResponse({ description: 'Evento actualizado.' })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  @ApiBadRequestResponse({ description: 'Fechas o creditos invalidos.' })
  @ApiConflictResponse({ description: 'El codigo del evento ya existe.' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }
}