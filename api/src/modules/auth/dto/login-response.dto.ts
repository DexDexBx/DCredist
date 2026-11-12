import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../../generated/prisma/client';
import { UserPermissionDto } from '../../users/dto/user-permissions.dto';

/** Perfil que devuelve el login. Nunca incluye el hash de la contrasena. */
export class LoginResponseDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ example: 1 })
  professionalSchoolId!: number;

  @ApiProperty({ example: 'Ingenieria de Sistemas' })
  professionalSchoolName!: string;

  @ApiProperty({
    description:
      'true: la contraseña es temporal; el frontend debe exigir el cambio antes de entrar al panel.',
  })
  mustChangePassword!: boolean;

  @ApiProperty({
    type: [UserPermissionDto],
    description: 'Matriz completa de permisos: una entrada por modulo.',
  })
  permissions!: UserPermissionDto[];
}
