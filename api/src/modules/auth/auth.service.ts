import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../../common/password';
import { UserRole, UserStatus } from '../../generated/prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  /**
   * Cambia la contraseña de la propia cuenta.
   *
   * Se exige la contraseña actual aunque la cuenta tenga una temporal: evita
   * que una sesión olvidada cambie la clave sin conocerla. Al terminar,
   * `mustChangePassword` queda en false y la cuenta opera con normalidad.
   */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto
  ): Promise<{ changed: boolean; mustChangePassword: false }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La sesión no es válida o la cuenta está inactiva.');
    }

    if (!verifyPassword(dto.currentPassword, user.passwordHash)) {
      throw new BadRequestException('La contraseña actual no es correcta.');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('La confirmación no coincide con la nueva contraseña.');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashPassword(dto.newPassword),
        mustChangePassword: false,
      },
    });

    return { changed: true, mustChangePassword: false };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        professionalSchool: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

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
      role: user.role.name as UserRole,
      status: user.status,
      professionalSchoolId: user.professionalSchoolId,
      professionalSchoolName: user.professionalSchool.name,
      mustChangePassword: user.mustChangePassword,
      permissions,
    };
  }
}
