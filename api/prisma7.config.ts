// Configuracion de Prisma 7 para DCredits.
// La cadena de conexion se lee de .env (nunca versionada).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
