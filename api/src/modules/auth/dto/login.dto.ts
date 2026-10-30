import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Credenciales de inicio de sesion contra la tabla `users`. */
export class LoginDto {
  @ApiProperty({ example: 'admin@dcredits.demo' })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
