import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { UserStatus } from '../../generated/prisma/client';
import { hashPassword } from '../../common/password';
import { isUniqueViolation } from '../../common/prisma/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, UserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';

type UserRow = Prisma.UserGetPayload<object>;

/**
 * DIRECTORIO DE USUARIOS.
 *
 * Administra los perfiles que operan DCredits: nombre, correo, rol, estado y
 * escuela profesional. La contraseña se recibe en claro y se guarda como hash
 * scrypt; el hash nunca sale de la base ni aparece en una respuesta.
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
    });

    return rows.map(toUserDto);
  }

  async findOne(id: string): Promise<UserDto> {
    const row = await this.prisma.user.findUnique({ where: { id } });

    if (!row) {
      throw new NotFoundException('El usuario no existe.');
    }

    return toUserDto(row);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    try {
      const row = await this.prisma.user.create({
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

      return toUserDto(row);
    } catch (error) {
      this.rethrowWriteError(error);
    }
  }

  /** Solo actualiza los campos enviados. `password` reemplaza el hash. */
  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    await this.ensureExists(id);

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

    try {
      const row = await this.prisma.user.update({ where: { id }, data });
      return toUserDto(row);
    } catch (error) {
      this.rethrowWriteError(error);
    }
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

  private async ensureExists(id: string): Promise<void> {
    const exists = await this.prisma.user.count({ where: { id } });

    if (exists === 0) {
      throw new NotFoundException('El usuario no existe.');
    }
  }

  /** Traduce la violacion UNIQUE del correo a 409 y deja pasar el resto. */
  private rethrowWriteError(error: unknown): never {
    if (isUniqueViolation(error, 'email')) {
      throw new ConflictException('Ya existe un usuario con este correo.');
    }

    throw error;
  }
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
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.role,
    status: row.status,
    professionalSchool: row.professionalSchool,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
