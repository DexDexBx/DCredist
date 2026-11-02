import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EventTypeDto } from './dto/event-type.dto';

/**
 * TIPOS DE EVENTO.
 *
 * Catalogo de solo lectura para el formulario de eventos. Los datos se cargan
 * en la migracion y en los seeds; el mantenimiento completo no forma parte de
 * esta version.
 */
@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<EventTypeDto[]> {
    return this.prisma.eventTypeCatalog.findMany({
      select: { id: true, name: true, status: true },
      orderBy: { id: 'asc' },
    });
  }
}
