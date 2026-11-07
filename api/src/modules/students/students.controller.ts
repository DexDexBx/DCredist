import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import { Public } from '../../common/actor/public.decorator';
import { ConstancyDto } from '../constancies/dto/constancy.dto';
import { StudentParticipationDto } from '../participations/dto/student-participation.dto';
import { ParticipationsService } from '../participations/participations.service';
import {
  CreateStudentDto,
  ImportStudentsDto,
  StudentImportResultDto,
  UpdateStudentDto,
} from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { StudentCreditSummaryDto } from './dto/student-credit-summary.dto';
import { StudentDetail } from './dto/student-detail.dto';
import {
  StudentPortalConsultDto,
  StudentPortalResultDto,
  StudentPortalSchoolDto,
} from './dto/student-portal.dto';
import { StudentFacetsDto, StudentListItemDto } from './dto/student-list-item.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly participationsService: ParticipationsService
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista estudiantes con filtros opcionales y su resumen de creditos.',
    description:
      'search coincide parcialmente con codigo, apellidos y nombres. Los creditos de cada fila se derivan de sus participaciones VALID. Un usuario de escuela solo ve el padron de su escuela.',
  })
  @ApiOkResponse({ type: [StudentListItemDto] })
  findAll(
    @Query() query: QueryStudentsDto,
    @CurrentActor() actor: Actor
  ): Promise<StudentListItemDto[]> {
    return this.studentsService.findAll(query, actor);
  }

  @Get('facets')
  @ApiOperation({
    summary: 'Escuelas profesionales y sedes del catalogo.',
    description: 'Alimenta los filtros del padron sin duplicar catalogos en el frontend.',
  })
  @ApiOkResponse({ type: StudentFacetsDto })
  findFacets(@CurrentActor() actor: Actor): Promise<StudentFacetsDto> {
    return this.studentsService.findFacets(actor);
  }

  @Public()
  @Get('portal/schools')
  @ApiOperation({
    summary: 'Escuelas profesionales para el portal publico del estudiante.',
    description:
      'No requiere sesion. Devuelve solo escuelas activas y excluye la escuela interna general.',
  })
  @ApiOkResponse({ type: [StudentPortalSchoolDto] })
  findPortalSchools(): Promise<StudentPortalSchoolDto[]> {
    return this.studentsService.findPortalSchools();
  }

  @Public()
  @Post('portal/consult')
  @ApiOperation({
    summary: 'Valida un codigo universitario contra su escuela y devuelve sus creditos.',
    description:
      'No requiere sesion. Primero verifica que el codigo exista y luego que pertenezca a la escuela seleccionada.',
  })
  @ApiOkResponse({ type: StudentPortalResultDto })
  @ApiBadRequestResponse({ description: 'El codigo no pertenece a la escuela seleccionada.' })
  @ApiNotFoundResponse({ description: 'El codigo universitario no existe.' })
  consultPortal(@Body() dto: StudentPortalConsultDto): Promise<StudentPortalResultDto> {
    return this.studentsService.consultPortal(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha del estudiante con participaciones y creditos acumulados.' })
  @ApiOkResponse({ type: StudentDetail })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<StudentDetail> {
    return this.studentsService.findDetail(id, actor);
  }

  @Get(':id/credits')
  @ApiOperation({
    summary: 'Creditos acumulados del estudiante.',
    description:
      'Los creditos se calculan desde PostgreSQL sumando participaciones VALID. No existe columna totalCredits.',
  })
  @ApiOkResponse({ type: StudentCreditSummaryDto })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  getCredits(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<StudentCreditSummaryDto> {
    return this.studentsService.getCreditSummary(id, actor);
  }

  @Get(':id/constancy')
  @ApiOperation({
    summary: 'Constancia de creditos persistida del estudiante.',
    description:
      'La crea si el estudiante ya cumple la meta y la mantiene actualizada sin cambiar su codigo.',
  })
  @ApiOkResponse({ type: ConstancyDto })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  getConstancy(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<ConstancyDto | null> {
    return this.studentsService.getConstancy(id, actor);
  }

  @Get(':id/participations')
  @ApiOperation({ summary: 'Historial de participaciones del estudiante, con su evento.' })
  @ApiOkResponse({ type: [StudentParticipationDto] })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  getParticipations(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<StudentParticipationDto[]> {
    return this.participationsService.findByStudent(id, actor);
  }

  @Post()
  @ApiOperation({ summary: 'Registra un estudiante. El codigo universitario es unico.' })
  @ApiCreatedResponse({ description: 'Estudiante creado.' })
  @ApiConflictResponse({ description: 'El codigo universitario ya existe.' })
  @ApiBadRequestResponse({ description: 'Datos invalidos.' })
  create(@Body() dto: CreateStudentDto, @CurrentActor() actor: Actor) {
    return this.studentsService.create(dto, actor);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita un estudiante o cambia su estado.',
    description: 'Solo se actualizan los campos enviados.',
  })
  @ApiOkResponse({ description: 'Estudiante actualizado.' })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  @ApiConflictResponse({ description: 'El codigo universitario ya existe.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStudentDto,
    @CurrentActor() actor: Actor
  ) {
    return this.studentsService.update(id, dto, actor);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Elimina un estudiante sin participaciones (solo administradores).',
    description:
      'Se bloquea si el estudiante tiene cualquier participacion, incluso anulada. Es un borrado definitivo.',
  })
  @ApiOkResponse({ description: 'Estudiante eliminado.' })
  @ApiForbiddenResponse({ description: 'El usuario no es administrador.' })
  @ApiConflictResponse({ description: 'El estudiante tiene participaciones asociadas.' })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentActor() actor: Actor
  ): Promise<{ deleted: boolean }> {
    return this.studentsService.remove(id, actor);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Carga incremental del padron.',
    description: [
      'La carga es estricta y atomica: si una fila trae una escuela o sede inexistente, no se escribe ninguna.',
      'Codigo nuevo -> se crea. Codigo existente -> completa solo los campos vacios.',
      'Devuelve el detalle de cada fila con error para corregir el archivo de una sola vez.',
    ].join(' '),
  })
  @ApiBody({ type: ImportStudentsDto })
  @ApiCreatedResponse({ type: StudentImportResultDto })
  @ApiBadRequestResponse({ description: 'El archivo no contiene filas o tiene errores.' })
  import(
    @Body() dto: ImportStudentsDto,
    @CurrentActor() actor: Actor
  ) {
    return this.studentsService.importStudents(dto, actor);
  }
}
