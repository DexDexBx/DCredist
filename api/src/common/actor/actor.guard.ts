import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { UserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { Actor } from './actor.types';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * RESOLUCION DEL USUARIO DE LA PETICION.
 *
 * El frontend envia `X-User-Id` con el id de la sesion. Este guard lo valida
 * contra la base, rechaza cuentas inexistentes o inactivas y deja el actor en
 * `request.actor` para que los servicios apliquen el alcance por escuela.
 *
 * No es un mecanismo de autenticacion fuerte: la cabecera puede falsificarse.
 * Cuando DCredits incorpore JWT, este guard sera el punto de reemplazo.
 */
@Injectable()
export class ActorGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { actor?: Actor }>();
    const rawHeader = request.headers['x-user-id'];
    const rawUserId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const userId = Number(rawUserId);

    if (!rawUserId || !Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException(
        'Falta la cabecera X-User-Id con el usuario de la sesion.'
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        role: { select: { name: true } },
        status: true,
        mustChangePassword: true,
        professionalSchoolId: true,
        professionalSchool: { select: { name: true } },
      },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La sesion no es valida o la cuenta esta inactiva.');
    }

    // Una cuenta con contraseña temporal solo puede cambiarla. El resto del
    // API queda bloqueado hasta que `mustChangePassword` pase a false.
    const isPasswordChange =
      request.method === 'POST' && request.path.endsWith('/auth/change-password');

    if (user.mustChangePassword && !isPasswordChange) {
      throw new ForbiddenException(
        'Debes cambiar tu contraseña inicial antes de continuar.'
      );
    }

    request.actor = {
      id: user.id,
      fullName: user.fullName,
      role: user.role.name as Actor['role'],
      professionalSchoolId: user.professionalSchoolId,
      professionalSchoolName: user.professionalSchool.name,
      isGlobal: isGeneralSchool(user.professionalSchool.name),
    };

    return true;
  }
}

/** `general` es el identificador de las cuentas globales, no una escuela real. */
export function isGeneralSchool(name: string): boolean {
  return name.trim().toLowerCase() === 'general';
}
