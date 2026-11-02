import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EventStatus } from '../../../generated/prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { blankToUndefined } from '../../../common/dto/blank-query';

/**
 * Filtros del listado de eventos. Todos se combinan con AND y todos son
 * opcionales: un parametro vacio ("") equivale a no filtrar.
 */
export class QueryEventsDto {
  @ApiPropertyOptional({ example: 'Congreso' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Tipo de evento academico.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @blankToUndefined()
  eventTypeId?: number;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  @blankToUndefined()
  status?: EventStatus;

  @ApiPropertyOptional({ example: 1, description: 'Escuela profesional del evento.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Organizador del evento.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizerId?: number;
}