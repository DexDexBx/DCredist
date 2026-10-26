import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * FARMACIA DE PRISMA.
 *
 * Prisma 7 exige un driver adapter explicito: el cliente no lee la cadena de
 * conexion por su cuenta. Este modulo es el unico lugar del backend donde se
 * construye la configuracion de conexion, para que el seed y la API usen
 * exactamente la misma.
 *
 * La cadena de conexion viene de DATABASE_URL (.env), nunca del codigo.
 */
export function prismaClientOptions(
  databaseUrl: string = process.env['DATABASE_URL'] ?? ''
): Prisma.PrismaClientOptions {
  if (!databaseUrl) {
    throw new Error(
      'Falta DATABASE_URL. Copia api/.env.example a api/.env y define la cadena de conexion a PostgreSQL.'
    );
  }

  return { adapter: new PrismaPg({ connectionString: databaseUrl }) };
}

/** Cliente independiente, para scripts como el seed. */
export function createPrismaClient(
  databaseUrl?: string
): PrismaClient {
  return new PrismaClient(prismaClientOptions(databaseUrl));
}
