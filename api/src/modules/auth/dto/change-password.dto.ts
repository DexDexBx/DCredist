import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MIN_PASSWORD_LENGTH } from '../../users/dto/create-user.dto';

/**
 * CAMBIO DE CONTRASEÑA DE LA PROPIA CUENTA.
 *
 * Se usa cuando la cuenta todavía tiene la contraseña inicial asignada por un
 * administrador (`mustChangePassword = true`). Exige la contraseña actual y la
 * confirmación de la nueva.
 */
export class ChangePasswordDto {
  @ApiProperty({
    example: 'ClaveTemporal2026',
    description: 'Contraseña actual de la cuenta.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({
    example: 'MiClavePersonal2026',
    description: `Nueva contraseña, mínimo ${MIN_PASSWORD_LENGTH} caracteres.`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  newPassword!: string;

  @ApiProperty({
    example: 'MiClavePersonal2026',
    description: 'Repetición de la nueva contraseña.',
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  confirmPassword!: string;
}
