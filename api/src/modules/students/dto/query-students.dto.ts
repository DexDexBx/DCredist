import { ApiPropertyOptional } from '@nestjs/swagger';
import { StudentStatus } from '../../../generated/prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { blankToUndefined } from '../../../common/dto/blank-query';

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

  @ApiPropertyOptional({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  professionalSchool?: string;

  @ApiPropertyOptional({ example: 'FILIAL LIMA' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  headquarters?: string;

  @ApiPropertyOptional({ enum: StudentStatus })
  @IsOptional()
  @IsEnum(StudentStatus)
  @blankToUndefined()
  status?: StudentStatus;
}