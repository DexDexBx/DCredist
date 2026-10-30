import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { verifyPassword } from '../../common/password';
import { UserStatus } from '../../generated/prisma/client';
import { UsersService } from '../users/users.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';

/**
 * AUTENTICACION.
 *
 * Valida correo + contrasena contra la tabla `users`. La contrasena se guarda
 * como hash scrypt con sal por usuario (formato `scrypt$<salHex>$<hashHex>`);
 * aqui solo se compara y nunca se devuelve ni se registra.
 *
 * El login devuelve tambien la matriz de permisos del usuario: es el unico
 * punto en el que el frontend la recibe completa y la guarda en su sesion.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Primero se valida la contraseña: el estado de la cuenta solo se revela a
    // quien ya demostró conocer la credencial.
    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('El correo o la contraseña no son correctos.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('El usuario está inactivo.');
    }

    const { permissions } = await this.usersService.findPermissions(user.id);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      professionalSchool: user.professionalSchool,
      mustChangePassword: user.mustChangePassword,
      permissions,
    };
  }
}
