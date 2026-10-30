import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../../generated/prisma/client';
import { UserPermissionDto } from '../../users/dto/user-permissions.dto';

/** Perfil que devuelve el login. Nunca incluye el hash de la contrasena. */
export class LoginResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty()
  professionalSchool!: string;

  @ApiProperty()
  mustChangePassword!: boolean;

  @ApiProperty({
    type: [UserPermissionDto],
    description: 'Matriz completa de permisos: una entrada por modulo.',
  })
  permissions!: UserPermissionDto[];
}
