import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
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
import { EventOrigin } from '../../../generated/prisma/client';

/**
 * Convierte cadenas vacias o solo espacios en `undefined`.
 *
 * Sin esto, una celda opcional vacia llega como "" y `@IsDateString()` (o
 * cualquier validador) rechaza TODA la carga con un 400, en lugar de tratarla
 * como un dato ausente.
 */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * FILA DE IMPORTACION DE EVENTOS.
 *
 * Escuela, organizador y tipo de evento se identifican por NOMBRE (igual que la
 * importacion de estudiantes): el backend los resuelve contra el catalogo. Las
 * fechas viajan como "YYYY-MM-DD"; modalidad y estado como su etiqueta en
 * espanol.
 */
export class ImportEventRowDto {
  @ApiProperty({ example: 'Congreso Internacional 2019' })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Congreso anual de investigacion.' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: '2019-10-05' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2019-10-07' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Congreso', description: 'Etiqueta en espanol del tipo.' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventType?: string;

  @ApiPropertyOptional({ example: 'Presencial' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  modality?: string;

  @ApiPropertyOptional({ example: 'Auditorio Central' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Finalizado' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  status?: string;

  @ApiPropertyOptional({ example: 0, description: '0 significa sin limite.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiProperty({ example: 'VICERRECTORIA ACADEMICA' })
  @IsString()
  @MaxLength(150)
  organizer!: string;

  @ApiProperty({ example: 'DERECHO' })
  @IsString()
  @MaxLength(150)
  professionalSchool!: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Obligatorio en la carga. Se valida por fila (1 a 21).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  credits?: number;

  @ApiPropertyOptional({ example: 'EVT-2019-001', description: 'Si se omite se genera.' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;
}

/**
 * CARGA MASIVA DE EVENTOS.
 */
export class ImportEventsDto {
  @ApiPropertyOptional({
    enum: EventOrigin,
    default: EventOrigin.CURRENT,
    description: 'CURRENT: reglas completas. LEGACY: campos opcionales del registro historico.',
  })
  @IsOptional()
  @IsEnum(EventOrigin)
  origin?: EventOrigin;

  @ApiProperty({ type: [ImportEventRowDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'El archivo no contiene filas para importar.' })
  @ArrayMaxSize(20000, { message: 'El archivo supera el maximo de 20000 filas por carga.' })
  @ValidateNested({ each: true })
  @Type(() => ImportEventRowDto)
  rows!: ImportEventRowDto[];
}

/** Fila que no se pudo registrar, con el motivo legible. */
export class EventImportIssueDto {
  @ApiProperty({ example: 7, description: 'Fila del archivo, empezando en 1.' })
  row!: number;

  @ApiProperty({ example: 'Congreso Internacional 2019' })
  name!: string;

  @ApiProperty({
    example: 'INVALID_ROW',
    description:
      'INVALID_ROW | DUPLICATE_CODE | MISSING_NAME | MISSING_DATES | MISSING_CREDITS | MISSING_EVENT_TYPE | MISSING_MODALITY | MISSING_STATUS | UNKNOWN_ORGANIZER | UNKNOWN_SCHOOL | FOREIGN_SCHOOL | DB_ERROR',
  })
  code!: string;

  @ApiProperty({ example: 'La fila no tiene nombre de evento.' })
  message!: string;
}

/** Resultado de la carga de eventos: reporte por fila. */
export class EventImportResultDto {
  @ApiProperty({ example: 120 }) total!: number;
  @ApiProperty({ example: 115 }) registered!: number;
  @ApiProperty({ example: 5 }) skipped!: number;
  @ApiProperty({ type: [EventImportIssueDto] }) issues!: EventImportIssueDto[];
}
