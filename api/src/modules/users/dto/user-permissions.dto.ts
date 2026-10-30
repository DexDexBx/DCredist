import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MODULE_NAMES } from '../../../common/permissions';
import { PermissionLevel } from '../../../generated/prisma/client';

/** Permiso de un usuario en un modulo concreto. */
export class UserPermissionDto {
  @ApiProperty({
    example: 'events',
    enum: [...MODULE_NAMES],
    description: 'Nombre del modulo (modules.name).',
  })
  @IsString()
  @IsIn([...MODULE_NAMES])
  module!: string;

  @ApiProperty({ enum: PermissionLevel, example: PermissionLevel.MANAGE })
  @IsEnum(PermissionLevel)
  permission!: PermissionLevel;
}

/** Cuerpo para reemplazar la matriz completa de un usuario. */
export class UpdateUserPermissionsDto {
  @ApiProperty({ type: [UserPermissionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserPermissionDto)
  permissions!: UserPermissionDto[];
}

/** Matriz de permisos tal como la devuelve el API. */
export class UserPermissionsDto {
  @ApiProperty({ type: [UserPermissionDto] })
  permissions!: UserPermissionDto[];
}
