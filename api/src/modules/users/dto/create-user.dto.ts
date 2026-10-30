import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '../../../generated/prisma/client';

/** Longitud minima de una contraseña de DCredits. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * ALTA DE USUARIOS.
 *
 * La contraseña la define quien crea la cuenta y se guarda como hash scrypt.
 * `mustChangePassword` queda en false: la persona conoce la contraseña desde el
 * primer inicio de sesión.
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

  @ApiPropertyOptional({
    example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA',
    description: 'Escuela profesional. Vacio para cuentas globales.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  professionalSchool?: string;
}

/**
 * EDICION DE USUARIOS.
 *
 * Todos los campos son opcionales: solo se actualiza lo enviado. Si se envia
 * `password`, se reemplaza el hash y la cuenta vuelve a `mustChangePassword`
 * en false.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/** Perfil publico de un usuario. Nunca incluye el hash de la contraseña. */
export class UserDto {
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
