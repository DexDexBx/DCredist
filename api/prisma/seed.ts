import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';

const prisma = createPrismaClient();

async function main(): Promise<void> {
  console.log('Seed sin datos de prueba.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed fallido:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
