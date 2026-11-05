import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  EventModality,
  EventOrigin,
  EventStatus,
  EventType,
} from '../../../generated/prisma/client';

/** Campos de un evento. Create y Update comparten las mismas reglas. */
export class EventFieldsDto {
  @ApiPropertyOptional({
    example: 'EVT-2026-004',
    description: 'Codigo del evento. Si se omite, el backend lo genera a partir del anio.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @ApiProperty({ example: 'Congreso Internacional de Educacion Superior' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    example: 'Evento academico internacional sobre innovacion.',
    description: 'Opcional. Si se omite se guarda "Sin descripcion". Minimo 3 caracteres.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'La descripcion debe tener al menos 3 caracteres.' })
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id del tipo de evento academico (GET /event-types). Opcional en registros historicos: se usa "No especificado".',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventTypeId?: number;

  @ApiPropertyOptional({
    enum: EventType,
    description:
      'Duracion (SINGLE_DAY / MULTI_DAY). Si se omite, el backend la deriva de startDate y endDate.',
  })
  @IsOptional()
  @IsEnum(EventType)
  durationType?: EventType;

  @ApiPropertyOptional({
    example: '2026-10-05',
    description:
      'Fecha calendario (YYYY-MM-DD). Opcional en registros historicos: se usa una fecha sentinela (1999-09-29) que la interfaz muestra como "Sin fecha".',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-07',
    description: 'Fecha calendario (YYYY-MM-DD). Igual o posterior a startDate.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: EventModality, default: EventModality.PRESENTIAL })
  @IsOptional()
  @IsEnum(EventModality)
  modality?: EventModality;

  @ApiPropertyOptional({ example: 'Auditorio Central, Sede Central' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 400, description: 'Nulo o positivo. 0 significa sin limite.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @ApiProperty({
    example: 1,
    description: 'Organizador del evento. Debe existir y estar activo en el catalogo.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizerId!: number;

  @ApiProperty({
    example: 1,
    description:
      'Escuela profesional duena del evento. Delimita que usuarios pueden operarlo.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId!: number;

  @ApiPropertyOptional({ example: 2, description: 'Creditos que otorga el evento. Nunca negativo.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'Los créditos deben ser como mínimo 1.' })
  @Max(21, { message: 'Los créditos no pueden superar 21.' })
  credits?: number;

  @ApiPropertyOptional({
    enum: EventStatus,
    default: EventStatus.SCHEDULED,
    description:
      'En registros historicos, si se omite, se guarda COMPLETED (Finalizado).',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({
    enum: EventOrigin,
    default: EventOrigin.CURRENT,
    description:
      'CURRENT: registro nuevo (reglas completas). LEGACY: registro historico (campos opcionales).',
  })
  @IsOptional()
  @IsEnum(EventOrigin)
  origin?: EventOrigin;
}

export class CreateEventDto extends EventFieldsDto {}