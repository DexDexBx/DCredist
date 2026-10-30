import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { blankToUndefined } from '../../../common/dto/blank-query';
import { UserRole, UserStatus } from '../../../generated/prisma/client';

/**
 * Filtros del directorio de usuarios. Todos son opcionales y se combinan con
 * AND; un parametro vacio ("") equivale a no filtrar.
 */
export class QueryUsersDto {
  @ApiPropertyOptional({
    example: 'ana',
    description: 'Busqueda parcial en nombre completo y correo.',
  })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  search?: string;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  @blankToUndefined()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  @blankToUndefined()
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  professionalSchool?: string;
}
