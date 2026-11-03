import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import {
  CreateParticipationDto,
  ImportParticipationsDto,
  ParticipationImportResultDto,
  QueryParticipationsDto,
  UpdateParticipationDto,
} from './dto/create-participation.dto';
import { ParticipationsService } from './participations.service';

@ApiTags('participations')
@Controller('participations')
export class ParticipationsController {
  constructor(private readonly participationsService: ParticipationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista participaciones con el evento y el estudiante resueltos.',
  })
  @ApiOkResponse({ description: 'Participaciones registradas.' })
  findAll(
    @Query() query: QueryParticipationsDto,
    @CurrentActor() actor: Actor
  ) {
    return this.participationsService.findAll(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una participacion.' })
  @ApiOkResponse({ description: 'Participacion con su evento.' })
  @ApiNotFoundResponse({ description: 'La participacion no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentActor() actor: Actor) {
    return this.participationsService.findOne(id, actor);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra una participacion.',
    description: [
      'Rechaza eventId + studentId duplicados.',
      'Rechaza eventId o studentId inexistentes.',
      'Rechaza eventos cancelados y eventos que alcanzaron su capacidad.',
      'Rechaza credits < 0.',
      'El verificationCode lo genera el servidor y se conserva siempre.',
      'grade es texto: "sin nota" o un numero entre 0 y 20.',
    ].join(' '),
  })
  @ApiCreatedResponse({ description: 'Participacion creada con su codigo DCredits.' })
  @ApiBadRequestResponse({ description: 'Creditos invalidos o evento cancelado.' })
  @ApiNotFoundResponse({ description: 'El evento o el estudiante no existen.' })
  @ApiConflictResponse({ description: 'El estudiante ya participa en ese evento.' })
  create(@Body() dto: CreateParticipationDto, @CurrentActor() actor: Actor) {
    return this.participationsService.create(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita una participacion.',
    description:
      'Sirve para anular (status = CANCELLED), reactivar, registrar la nota o el codigo del certificado. El verificationCode nunca cambia.',
  })
  @ApiOkResponse({ description: 'Participacion actualizada.' })
  @ApiNotFoundResponse({ description: 'La participacion no existe.' })
  @ApiBadRequestResponse({ description: 'Creditos o nota invalidos.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateParticipationDto,
    @CurrentActor() actor: Actor
  ) {
    return this.participationsService.update(id, dto, actor);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Carga masiva de participantes de un evento.',
    description: [
      'Identifica a los estudiantes por codigo universitario.',
      'Nunca crea estudiantes: los codigos ausentes se reportan por fila.',
      'Es idempotente: repetir la carga no duplica, marca ALREADY_REGISTERED.',
      'Devuelve un reporte por fila. Un error no descarta el resto del archivo.',
      'El verificationCode lo genera el servidor para cada fila.',
    ].join(' '),
  })
  @ApiBody({ type: ImportParticipationsDto })
  @ApiCreatedResponse({ type: ParticipationImportResultDto })
  @ApiBadRequestResponse({ description: 'Archivo vacio o evento cancelado.' })
  @ApiNotFoundResponse({ description: 'El evento no existe.' })
  import(@Body() dto: ImportParticipationsDto, @CurrentActor() actor: Actor) {
    return this.participationsService.importParticipations(dto, actor);
  }
}