import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ParticipationStatus } from '../../../generated/prisma/client';
import { MAX_GRADE } from '../../../common/domain';
import { blankToUndefined } from '../../../common/dto/blank-query';

/**
 * ALTA DE UNA PARTICIPACION.
 *
 * El `verificationCode` NO se recibe: lo genera el servidor una sola vez y se
 * conserva. Si se envia, se ignora.
 */
export class CreateParticipationDto {
  @ApiProperty({ description: 'Evento en el que se registra la participacion.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId!: number;

  @ApiProperty({ description: 'Estudiante que participa.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId!: number;

  @ApiPropertyOptional({
    example: '2026-10-05T09:00:00.000Z',
    description: 'Si se omite, se usa la fecha de inicio del evento.',
  })
  @IsOptional()
  @IsDateString()
  participationDate?: string;

  @ApiPropertyOptional({
    example: 1.5,
    description:
      'Se ignora: los creditos se toman siempre del evento. Se conserva por compatibilidad.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  credits?: number;

  @ApiPropertyOptional({
    example: 16,
    description: 'Nota. Admite null: "sin nota registrada" jamas se convierte en 0.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_GRADE)
  grade?: number | null;

  @ApiPropertyOptional({ enum: ParticipationStatus, default: ParticipationStatus.VALID })
  @IsOptional()
  @IsEnum(ParticipationStatus)
  status?: ParticipationStatus;
}

/** Edicion parcial. El verificationCode nunca se modifica. */
export class UpdateParticipationDto extends PartialType(CreateParticipationDto) {}

/**
 * Consulta de participaciones con filtros opcionales. Todos se combinan con AND
 * y un parametro vacio ("") equivale a no filtrar.
 */
export class QueryParticipationsDto {
  @ApiPropertyOptional({ description: 'Filtra por evento.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @blankToUndefined()
  eventId?: number;

  @ApiPropertyOptional({ description: 'Filtra por estudiante.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @blankToUndefined()
  studentId?: number;

  @ApiPropertyOptional({ enum: ParticipationStatus })
  @IsOptional()
  @IsEnum(ParticipationStatus)
  @blankToUndefined()
  status?: ParticipationStatus;

  @ApiPropertyOptional({ example: 'DC-2026-8F4K2P', description: 'Busca por codigo DCredits exacto.' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  verificationCode?: string;

  @ApiPropertyOptional({ description: 'Codigo universitario, apellidos o nombres.' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  search?: string;
}

/**
 * FILA DE IMPORTACION.
 *
 * El estudiante se identifica por `universityCode`: es el dato que la
 * institucion tiene en su padron. La carga NUNCA crea estudiantes; los codigos
 * que no existan se devuelven como `notFound` para poder reportarlos.
 */
export class ParticipationImportRowDto {
  @ApiProperty({ example: '2213271', description: 'Codigo universitario del padron.' })
  @IsString()
  @MaxLength(32)
  universityCode!: string;

  @ApiPropertyOptional({ example: 1.5, description: 'Si se omite, los creditos del evento.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  credits?: number;

  @ApiPropertyOptional({ example: 16, description: 'La celda vacia se envia como null.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_GRADE)
  grade?: number | null;

  @ApiPropertyOptional({ example: '2026-10-05T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  participationDate?: string;

  @ApiPropertyOptional({
    enum: ParticipationStatus,
    description: 'Por defecto la participacion queda VALID. Se puede importar como PENDING.',
  })
  @IsOptional()
  @IsEnum(ParticipationStatus)
  status?: ParticipationStatus;
}

/**
 * CARGA MASIVA DE PARTICIPANTES DE UN EVENTO.
 *
 * Es idempotente por evento + estudiante: repetir la carga no duplica, solo
 * reporta los que ya estaban registrados.
 */
export class ImportParticipationsDto {
  @ApiProperty({ description: 'Evento destino de la carga.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventId!: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Creditos aplicados a las filas que no traen creditos propios.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultCredits?: number;

  @ApiProperty({ type: [ParticipationImportRowDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'El archivo no contiene filas para importar.' })
  @ArrayMaxSize(5000, { message: 'El archivo supera el maximo de 5000 filas por carga.' })
  @ValidateNested({ each: true })
  @Type(() => ParticipationImportRowDto)
  rows!: ParticipationImportRowDto[];
}

/** Fila que no se pudo registrar, con el motivo legible. */
export class ParticipationImportIssueDto {
  @ApiProperty({ example: 7, description: 'Fila del archivo, empezando en 1.' })
  row!: number;

  @ApiProperty({ example: '2213999' })
  universityCode!: string;

  @ApiProperty({
    example: 'STUDENT_NOT_FOUND',
    description: 'STUDENT_NOT_FOUND | STUDENT_OTHER_SCHOOL | STUDENT_INACTIVE | DUPLICATE_IN_FILE | ALREADY_REGISTERED | EVENT_FULL | INVALID_ROW | DB_ERROR',
  })
  code!: string;

  @ApiProperty({ example: 'El código no existe en el padrón de estudiantes.' })
  message!: string;
}

/**
 * Resultado de la carga: un reporte por fila, nunca un todo-o-nada.
 * Las filas validas se registran aunque el resto del archivo tenga errores.
 */
export class ParticipationImportResultDto {
  @ApiProperty({ example: 120, description: 'Filas unicas leidas del archivo.' })
  total!: number;

  @ApiProperty({ example: 115, description: 'Participaciones creadas.' })
  registered!: number;

  @ApiProperty({ example: 112, description: 'Codigos que existen en el padron.' })
  found!: number;

  @ApiProperty({
    example: 5,
    description: 'Filas no registradas por cap, duplicado o dato invalido.',
  })
  skipped!: number;

  @ApiProperty({ type: [ParticipationImportIssueDto] })
  issues!: ParticipationImportIssueDto[];
}