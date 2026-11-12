import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '../../../generated/prisma/client';

/** Longitud minima de una contraseña de DCredits. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * ALTA DE USUARIOS.
 *
 * La contraseña la define quien crea la cuenta y se guarda como hash scrypt.
 * `mustChangePassword` queda en true: la clave es temporal y la persona debe
 * cambiarla en su primer inicio de sesión.
 *
 * `professionalSchoolId` es obligatorio: la escuela define el alcance del
 * usuario. La escuela `general` identifica a las cuentas globales.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'Ana Torres', description: 'Nombre y apellidos.' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'ana.torres@institucion.edu', description: 'Correo unico.' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({
    example: 'ClaveSegura2026',
    description: `Contraseña inicial, minimo ${MIN_PASSWORD_LENGTH} caracteres.`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  password!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.OPERATOR })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiProperty({
    example: 1,
    description: 'Escuela profesional del usuario. General = acceso global.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId!: number;
}

/**
 * EDICION DE USUARIOS.
 *
 * Todos los campos son opcionales: solo se actualiza lo enviado. Si se envia
 * `password`, se reemplaza el hash y la cuenta vuelve a `mustChangePassword`
 * en true: la nueva clave es temporal hasta que la persona la cambie.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/** Perfil publico de un usuario. Nunca incluye el hash de la contraseña. */
export class UserDto {
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
      'true: la cuenta conserva una contraseña temporal y debe cambiarla antes de usar el sistema.',
  })
  mustChangePassword!: boolean;

  @ApiProperty({
    example: 2,
    description:
      'Cuantos modulos difieren del preset del rol. Evita enviar la matriz completa en el listado.',
  })
  permissionsOverridden!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
