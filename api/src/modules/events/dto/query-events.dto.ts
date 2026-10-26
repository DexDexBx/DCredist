import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../../../generated/prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { EVENT_CATEGORIES } from '../../../common/domain';
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

  @ApiPropertyOptional({ enum: EVENT_CATEGORIES })
  @IsOptional()
  @IsIn(EVENT_CATEGORIES)
  @blankToUndefined()
  category?: string;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  @blankToUndefined()
  status?: EventStatus;
}