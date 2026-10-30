import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '../../../generated/prisma/client';

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
}
