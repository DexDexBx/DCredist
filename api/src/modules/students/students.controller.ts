import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
      'search coincide parcialmente con codigo, apellidos y nombres. Los creditos de cada fila se derivan de sus participaciones VALID.',
  })
  @ApiOkResponse({ type: [StudentListItemDto] })
  findAll(@Query() query: QueryStudentsDto): Promise<StudentListItemDto[]> {
    return this.studentsService.findAll(query);
  }

  @Get('facets')
  @ApiOperation({
    summary: 'Escuelas profesionales y sedes existentes.',
    description: 'Alimenta los filtros del padron sin duplicar catálogos en el frontend.',
  })
  @ApiOkResponse({ type: StudentFacetsDto })
  findFacets(): Promise<StudentFacetsDto> {
    return this.studentsService.findFacets();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha del estudiante con participaciones y credos acumulados.' })
  @ApiOkResponse({ type: StudentDetail })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  findOne(@Param('id') id: string): Promise<StudentDetail> {
    return this.studentsService.findDetail(id);
  }

  @Get(':id/credits')
  @ApiOperation({
    summary: 'Creditos acumulados del estudiante.',
    description:
      'Los creditos se calculan desde PostgreSQL sumando participaciones VALID. No existe columna totalCredits.',
  })
  @ApiOkResponse({ type: StudentCreditSummaryDto })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  getCredits(@Param('id') id: string): Promise<StudentCreditSummaryDto> {
    return this.studentsService.getCreditSummary(id);
  }

  @Get(':id/participations')
  @ApiOperation({ summary: 'Historial de participaciones del estudiante, con su evento.' })
  @ApiOkResponse({ type: [StudentParticipationDto] })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  getParticipations(@Param('id') id: string): Promise<StudentParticipationDto[]> {
    return this.participationsService.findByStudent(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra un estudiante. El codigo universitario es unico.' })
  @ApiCreatedResponse({ description: 'Estudiante creado.' })
  @ApiConflictResponse({ description: 'El codigo universitario ya existe.' })
  @ApiBadRequestResponse({ description: 'Datos invalidos.' })
  create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita un estudiante o cambia su estado.',
    description: 'Solo se actualizan los campos enviados.',
  })
  @ApiOkResponse({ description: 'Estudiante actualizado.' })
  @ApiNotFoundResponse({ description: 'El estudiante no existe.' })
  @ApiConflictResponse({ description: 'El codigo universitario ya existe.' })
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Carga incremental del padron.',
    description: [
      'Nunca es destructiva: no borra estudiantes ni participaciones.',
      'Codigo nuevo -> se crea. Codigo existente -> completa solo los campos vacios.',
      'Es idempotente: reenviar el mismo archivo no cambia el resultado.',
      'Devuelve un reporte por fila; los errores no descartan el resto del archivo.',
    ].join(' '),
  })
  @ApiBody({ type: ImportStudentsDto })
  @ApiCreatedResponse({ type: StudentImportResultDto })
  @ApiBadRequestResponse({ description: 'El archivo no contiene filas.' })
  import(@Body() dto: ImportStudentsDto) {
    return this.studentsService.importStudents(dto);
  }
}