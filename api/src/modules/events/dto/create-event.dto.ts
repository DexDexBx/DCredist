import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EventModality, EventStatus, EventType } from '../../../generated/prisma/client';
import { EVENT_CATEGORIES } from '../../../common/domain';

/** "HH:mm" o "HH:mm:ss". El backend no impone una duracion maxima. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

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

  @ApiPropertyOptional({ example: 'Evento academico internacional sobre innovacion.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: EVENT_CATEGORIES,
    default: 'Congreso',
    description: 'Categoria academica. Es el "tipo" que muestra la institucion.',
  })
  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({
    enum: EventType,
    description: 'Si se omite, el backend lo deriva de startDate y endDate.',
  })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiProperty({ example: '2026-10-05T00:00:00.000Z', description: 'ISO 8601.' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    example: '2026-10-07T00:00:00.000Z',
    description: 'Debe ser mayor o igual que startDate. No hay limite de dias.',
  })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: '08:30', description: 'Formato HH:mm.' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime debe tener el formato HH:mm.' })
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00', description: 'Formato HH:mm.' })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime debe tener el formato HH:mm.' })
  endTime?: string;

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
  capacity?: number | null;

  @ApiPropertyOptional({ example: 'Vicerrectoria Academica' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  organizer?: string;

  @ApiPropertyOptional({ example: 2, description: 'Creditos que otorga el evento. Nunca negativo.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  credits?: number;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.SCHEDULED })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}

export class CreateEventDto extends EventFieldsDto {}