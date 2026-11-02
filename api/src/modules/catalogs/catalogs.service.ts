import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { CatalogStatus } from '../../generated/prisma/client';
import type { Actor } from '../../common/actor/actor.types';
import { isGeneralSchool } from '../../common/actor/actor.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CatalogEntryDto,
  CreateCatalogEntryDto,
  QueryCatalogDto,
  UpdateCatalogEntryDto,
} from './dto/catalog.dto';

const GENERAL_NAME = 'general';

/**
 * MANTENIMIENTO DE CATALOGOS.
 *
 * Las escuelas, sedes y organizadores son tablas reales. El CRUD es el mismo
 * para las tres, pero el conteo de uso cambia: una escuela la referencian
 * usuarios, estudiantes y eventos; una sede solo estudiantes; un organizador
 * solo eventos.
 *
 * `general` es la escuela de las cuentas globales. No es una escuela real: se
 * oculta de los listados (salvo que un usuario global pida incluirla para el
 * formulario de usuarios) y no se puede editar ni eliminar desde el catalogo.
 */
@Injectable()
export class CatalogsService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // ESCUELAS PROFESIONALES
  // -------------------------------------------------------------------------

  async findProfessionalSchools(
    query: QueryCatalogDto,
    actor: Actor
  ): Promise<CatalogEntryDto[]> {
    const includeGeneral = actor.isGlobal && query.includeGeneral === 'true';
    const search = query.search?.trim();

    const rows = await this.prisma.professionalSchool.findMany({
      where: {
        AND: [
          ...(includeGeneral
            ? []
            : [
                {
                  NOT: {
                    name: { equals: GENERAL_NAME, mode: 'insensitive' as const },
                  },
                },
              ]),
          ...(search
            ? [{ name: { contains: search, mode: 'insensitive' as const } }]
            : []),
        ],
        ...(query.status ? { status: query.status } : {}),
      } satisfies Prisma.ProfessionalSchoolWhereInput,
      include: {
        _count: { select: { users: true, students: true, events: true } },
      },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) =>
      toDto(
        row,
        row._count.users + row._count.students + row._count.events
      )
    );
  }

  async findProfessionalSchool(id: number): Promise<CatalogEntryDto> {
    const row = await this.findSchoolRow(id);

    if (isGeneralSchool(row.name)) {
      throw new NotFoundException('La escuela general no forma parte del catalogo.');
    }

    return toDto(
      row,
      row._count.users + row._count.students + row._count.events
    );
  }

  async createProfessionalSchool(dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    const name = normalizeName(dto.name);

    if (isGeneralSchool(name)) {
      throw new ConflictException(
        'La escuela "general" es del sistema y no se puede crear desde el catalogo.'
      );
    }

    await this.assertSchoolNameFree(name);

    const created = await this.prisma.professionalSchool.create({
      data: { name, status: dto.status ?? CatalogStatus.ACTIVE },
      include: { _count: { select: { users: true, students: true, events: true } } },
    });

    return toDto(created, 0);
  }

  async updateProfessionalSchool(
    id: number,
    dto: UpdateCatalogEntryDto
  ): Promise<CatalogEntryDto> {
    const current = await this.findSchoolRow(id);

    if (isGeneralSchool(current.name)) {
      throw new ConflictException(
        'La escuela "general" es del sistema y no se puede modificar desde el catalogo.'
      );
    }

    if (dto.name !== undefined) {
      const name = normalizeName(dto.name);

      if (isGeneralSchool(name)) {
        throw new ConflictException('Ese nombre esta reservado por el sistema.');
      }

      await this.assertSchoolNameFree(name, id);
    }

    const updated = await this.prisma.professionalSchool.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: normalizeName(dto.name) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { users: true, students: true, events: true } } },
    });

    return toDto(
      updated,
      updated._count.users + updated._count.students + updated._count.events
    );
  }

  async removeProfessionalSchool(id: number): Promise<void> {
    const row = await this.findSchoolRow(id);

    if (isGeneralSchool(row.name)) {
      throw new ConflictException('La escuela "general" no se puede eliminar.');
    }

    const usage = row._count.users + row._count.students + row._count.events;

    if (usage > 0) {
      throw new ConflictException(
        `No se puede eliminar "${row.name}": tiene ${usage} registro(s) vinculado(s). Desactivala en su lugar.`
      );
    }

    await this.prisma.professionalSchool.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // SEDES
  // -------------------------------------------------------------------------

  async findLocations(query: QueryCatalogDto): Promise<CatalogEntryDto[]> {
    const rows = await this.prisma.location.findMany({
      where: this.catalogWhere(query),
      include: { _count: { select: { students: true } } },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => toDto(row, row._count.students));
  }

  async findLocation(id: number): Promise<CatalogEntryDto> {
    const row = await this.findLocationRow(id);
    return toDto(row, row._count.students);
  }

  async createLocation(dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    const name = normalizeName(dto.name);
    await this.assertLocationNameFree(name);

    const created = await this.prisma.location.create({
      data: { name, status: dto.status ?? CatalogStatus.ACTIVE },
      include: { _count: { select: { students: true } } },
    });

    return toDto(created, 0);
  }

  async updateLocation(id: number, dto: UpdateCatalogEntryDto): Promise<CatalogEntryDto> {
    const current = await this.findLocationRow(id);

    if (dto.name !== undefined) {
      await this.assertLocationNameFree(normalizeName(dto.name), id);
    }

    const updated = await this.prisma.location.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: normalizeName(dto.name) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { students: true } } },
    });

    return toDto(updated, updated._count.students);
  }

  async removeLocation(id: number): Promise<void> {
    const row = await this.findLocationRow(id);

    if (row._count.students > 0) {
      throw new ConflictException(
        `No se puede eliminar "${row.name}": tiene ${row._count.students} estudiante(s) vinculado(s). Desactivala en su lugar.`
      );
    }

    await this.prisma.location.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // ORGANIZADORES
  // -------------------------------------------------------------------------

  async findOrganizers(query: QueryCatalogDto): Promise<CatalogEntryDto[]> {
    const rows = await this.prisma.organizer.findMany({
      where: this.catalogWhere(query),
      include: { _count: { select: { events: true } } },
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => toDto(row, row._count.events));
  }

  async findOrganizer(id: number): Promise<CatalogEntryDto> {
    const row = await this.findOrganizerRow(id);
    return toDto(row, row._count.events);
  }

  async createOrganizer(dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    const name = normalizeName(dto.name);
    await this.assertOrganizerNameFree(name);

    const created = await this.prisma.organizer.create({
      data: { name, status: dto.status ?? CatalogStatus.ACTIVE },
      include: { _count: { select: { events: true } } },
    });

    return toDto(created, 0);
  }

  async updateOrganizer(id: number, dto: UpdateCatalogEntryDto): Promise<CatalogEntryDto> {
    await this.findOrganizerRow(id);

    if (dto.name !== undefined) {
      await this.assertOrganizerNameFree(normalizeName(dto.name), id);
    }

    const updated = await this.prisma.organizer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: normalizeName(dto.name) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { _count: { select: { events: true } } },
    });

    return toDto(updated, updated._count.events);
  }

  async removeOrganizer(id: number): Promise<void> {
    const row = await this.findOrganizerRow(id);

    if (row._count.events > 0) {
      throw new ConflictException(
        `No se puede eliminar "${row.name}": tiene ${row._count.events} evento(s) vinculado(s). Desactivalo en su lugar.`
      );
    }

    await this.prisma.organizer.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // APOYO
  // -------------------------------------------------------------------------

  private catalogWhere(query: QueryCatalogDto) {
    const search = query.search?.trim();

    return {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };
  }

  private async findSchoolRow(id: number) {
    const row = await this.prisma.professionalSchool.findUnique({
      where: { id },
      include: { _count: { select: { users: true, students: true, events: true } } },
    });

    if (!row) {
      throw new NotFoundException('La escuela profesional no existe.');
    }

    return row;
  }

  private async findLocationRow(id: number) {
    const row = await this.prisma.location.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });

    if (!row) {
      throw new NotFoundException('La sede no existe.');
    }

    return row;
  }

  private async findOrganizerRow(id: number) {
    const row = await this.prisma.organizer.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });

    if (!row) {
      throw new NotFoundException('El organizador no existe.');
    }

    return row;
  }

  private async assertSchoolNameFree(name: string, ignoreId?: number): Promise<void> {
    const existing = await this.prisma.professionalSchool.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' as const },
        ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una escuela profesional con el nombre "${name}".`);
    }
  }

  private async assertLocationNameFree(name: string, ignoreId?: number): Promise<void> {
    const existing = await this.prisma.location.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' as const },
        ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una sede con el nombre "${name}".`);
    }
  }

  private async assertOrganizerNameFree(name: string, ignoreId?: number): Promise<void> {
    const existing = await this.prisma.organizer.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' as const },
        ...(ignoreId !== undefined ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un organizador con el nombre "${name}".`);
    }
  }
}

/** Un solo espacio entre palabras; conserva el nombre que escribio la institucion. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function toDto(
  row: { id: number; name: string; status: CatalogStatus; createdAt: Date; updatedAt: Date },
  usageCount: number
): CatalogEntryDto {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    usageCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
