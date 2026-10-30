import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ModuleDto } from './dto/module.dto';

/**
 * CATALOGO DE MODULOS.
 *
 * Es la fuente de verdad de los modulos del sistema. El frontend conserva las
 * etiquetas y descripciones (son texto de interfaz), pero los permisos se
 * guardan contra el `id` de estas filas.
 */
@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ModuleDto[]> {
    return this.prisma.module.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
}
