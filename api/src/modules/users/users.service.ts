import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, UserRole } from '../../generated/prisma/client';
import { UserStatus } from '../../generated/prisma/client';
import { hashPassword } from '../../common/password';
import { defaultPermission } from '../../common/permissions';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import {
  UpdateUserPermissionsDto,
  UserPermissionDto,
  UserPermissionsDto,
} from './dto/user-permissions.dto';

/** Todo usuario viaja con el nombre de cada modulo para calcular sus ajustes. */
const permissionsInclude = {
  permissions: { include: { module: { select: { name: true } } } },
} satisfies Prisma.UserInclude;

type UserRow = Prisma.UserGetPayload<{ include: typeof permissionsInclude }>;

/**
 * DIRECTORIO DE USUARIOS.
 *
 * Administra los perfiles que operan DCredits: nombre, correo, rol, estado y
 * escuela profesional. La contraseña se recibe en claro y se guarda como hash
 * scrypt; el hash nunca sale de la base ni aparece en una respuesta.
 *
 * Cada usuario tiene su propia matriz de permisos en `user_module_permissions`.
 * Al crearlo (y al cambiarle el rol) se copia el preset de su rol; despues
 * puede diferir del resto aunque comparta perfil.
 *
 * Regla de dominio: el correo es UNIQUE. La constraint de PostgreSQL es la
 * garantia real y aqui se traduce a un 409 legible.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado con filtros opcionales; todos se combinan con AND. */
  async findAll(query: QueryUsersDto): Promise<UserDto[]> {
    const rows = await this.prisma.user.findMany({
      where: this.buildWhere(query),
      orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
      include: permissionsInclude,
    });

    return rows.map(toUserDto);
  }

  async findOne(id: string): Promise<UserDto> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: permissionsInclude,
    });

    if (!row) {
      throw new NotFoundException('El usuario no existe.');
    }

    return toUserDto(row);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            fullName: normalizeName(dto.fullName),
            email: normalizeEmail(dto.email),
            passwordHash: hashPassword(dto.password),
            // La contraseña la elige quien crea la cuenta: no es temporal.
            mustChangePassword: false,
            role: dto.role,
            status: dto.status ?? UserStatus.ACTIVE,
            professionalSchool: dto.professionalSchool?.trim() ?? '',
          },
        });

        // Un usuario nuevo arranca con el preset de su rol.
        await replacePermissions(tx, user.id, user.role);

        return user;
      });

      return this.findOne(created.id);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** Solo actualiza los campos enviados. `password` reemplaza el hash. */
  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!current) {
      throw new NotFoundException('El usuario no existe.');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.fullName !== undefined) {
      data.fullName = normalizeName(dto.fullName);
    }
    if (dto.email !== undefined) {
      data.email = normalizeEmail(dto.email);
    }
    if (dto.password !== undefined) {
      data.passwordHash = hashPassword(dto.password);
      data.mustChangePassword = false;
    }
    if (dto.role !== undefined) {
      data.role = dto.role;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.professionalSchool !== undefined) {
      data.professionalSchool = dto.professionalSchool.trim();
    }

    const nextRole = dto.role;
    const roleChanged = nextRole !== undefined && nextRole !== current.role;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data });

        // Cambiar de perfil reemplaza la matriz por la del nuevo rol: evita
        // combinaciones incoherentes (un Coordinador con accesos de Admin).
        if (roleChanged && nextRole) {
          await replacePermissions(tx, id, nextRole);
        }
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }

    return this.findOne(id);
  }

  /**
   * Matriz de permisos de un usuario. Si todavia no tiene filas (cuenta creada
   * antes de existir esta tabla) se devuelve el preset de su rol.
   */
  async findPermissions(id: string): Promise<UserPermissionsDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('El usuario no existe.');
    }

    const [modules, rows] = await Promise.all([
      this.prisma.module.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.userModulePermission.findMany({
        where: { userId: id },
        select: { moduleId: true, permission: true },
      }),
    ]);

    const byModule = new Map(rows.map((row) => [row.moduleId, row.permission]));

    return {
      permissions: modules.map((module) => ({
        module: module.name,
        permission: byModule.get(module.id) ?? defaultPermission(user.role, module.name),
      })),
    };
  }

  /** Reemplaza la matriz completa del usuario con la que envia el frontend. */
  async updatePermissions(id: string, dto: UpdateUserPermissionsDto): Promise<UserPermissionsDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('El usuario no existe.');
    }

    await this.prisma.$transaction((tx) =>
      replacePermissions(tx, id, user.role, dto.permissions)
    );

    return this.findPermissions(id);
  }

  private buildWhere(query: QueryUsersDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    const search = query.search?.trim();

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.professionalSchool) {
      where.professionalSchool = query.professionalSchool;
    }

    return where;
  }

  /** Traduce la violacion UNIQUE del correo a 409 y deja pasar el resto. */
  private rethrowWriteError(error: unknown): never {
    if (isUniqueViolation(error, 'email')) {
      throw new ConflictException('Ya existe un usuario con este correo.');
    }

    throw error;
  }
}

/**
 * Deja la matriz del usuario exactamente con una fila por modulo.
 *
 * Sin `entries` se usa el preset del rol. Con `entries` se respeta lo enviado y
 * lo que falte cae al preset (por ejemplo, un modulo agregado despues).
 */
async function replacePermissions(
  tx: Prisma.TransactionClient,
  userId: string,
  role: UserRole,
  entries?: UserPermissionDto[]
): Promise<void> {
  const modules = await tx.module.findMany({ select: { id: true, name: true } });

  await tx.userModulePermission.deleteMany({ where: { userId } });

  if (modules.length === 0) {
    return;
  }

  const requested = new Map((entries ?? []).map((entry) => [entry.module, entry.permission]));

  await tx.userModulePermission.createMany({
    data: modules.map((module) => ({
      userId,
      moduleId: module.id,
      permission: requested.get(module.name) ?? defaultPermission(role, module.name),
    })),
  });
}

/** El correo se guarda normalizado: el login busca exactamente por este valor. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Un solo espacio entre palabras; conserva las mayusculas que escribio el usuario. */
function normalizeName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ');
}

function toUserDto(row: UserRow): UserDto {
  const permissionsOverridden = row.permissions.filter(
    (entry) => defaultPermission(row.role, entry.module.name) !== entry.permission
  ).length;

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    status: row.status,
    professionalSchool: row.professionalSchool,
    mustChangePassword: row.mustChangePassword,
    permissionsOverridden,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
