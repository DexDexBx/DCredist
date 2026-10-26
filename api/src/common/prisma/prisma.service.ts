import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { prismaClientOptions } from './prisma-client-factory';

/**
 * Cliente Prisma compartido por todos los modulos de la API.
 *
 * Es la unica pieza que habla con PostgreSQL: ningun controller ni service de
 * dominio abre conexiones propias.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(prismaClientOptions());
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
