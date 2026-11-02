import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { blankToUndefined } from '../../../common/dto/blank-query';
import { StudentStatus } from '../../../generated/prisma/client';

/**
 * Filtros del padron de estudiantes. Todos se combinan con AND y todos son
 * opcionales: un parametro vacio ("") equivale a no filtrar.
 */
export class QueryStudentsDto {
  @ApiPropertyOptional({ example: '2213271', description: 'Busqueda exacta por codigo universitario.' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  universityCode?: string;

  @ApiPropertyOptional({ example: 'AGUILAR', description: 'Busqueda parcial en codigo, apellidos y nombres.' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  search?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId?: number;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  @blankToUndefined()
  status?: StudentStatus;
}
