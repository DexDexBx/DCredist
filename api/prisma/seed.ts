import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';
import { seedAcademicDemo } from './demo-data';

/**
 * SEED MINIMO DE DCREDITS.
 *
 * Carga el escenario academico de demostracion desde `demo-data.ts`:
 *  - catalogos de escuelas, sedes y organizadores,
 *  - 5 estudiantes,
 *  - 4 eventos con fechas calendario (sin hora) y sello de autoria,
 *  - 6 participaciones.
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada.
 * NO borra datos existentes.
 */

const prisma = createPrismaClient();

async function main(): Promise<void> {
  const totals = await seedAcademicDemo(prisma);

  console.log('Seed de DCredits completado:');
  console.log(`  escuelas      : ${totals.escuelas}`);
  console.log(`  sedes         : ${totals.sedes}`);
  console.log(`  organizadores : ${totals.organizadores}`);
  console.log(`  tipos de evento: ${totals.tiposEvento}`);
  console.log(`  estudiantes   : ${totals.estudiantes}`);
  console.log(`  eventos       : ${totals.eventos}`);
  console.log(`  participaciones: ${totals.participaciones}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed fallido:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
