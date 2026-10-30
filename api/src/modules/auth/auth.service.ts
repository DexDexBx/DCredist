import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { verifyPassword } from '../../common/password';
import { UserStatus } from '../../generated/prisma/client';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';

/**
 * AUTENTICACION.
 *
 * Valida correo + contrasena contra la tabla `users`. La contrasena se guarda
 * como hash scrypt con sal por usuario (formato `scrypt$<salHex>$<hashHex>`);
 * aqui solo se compara y nunca se devuelve ni se registra.
 */
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // El mismo mensaje para correo inexistente y contrasena incorrecta: no se
    // revela si la cuenta existe.
    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('El correo o la contraseña no son correctos.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La cuenta está inactiva.');
    }

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      professionalSchool: user.professionalSchool,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
