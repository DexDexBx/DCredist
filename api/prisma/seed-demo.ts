import 'dotenv/config';
import { hashPassword } from '../src/common/password';
import { defaultPermission, MODULE_NAMES } from '../src/common/permissions';
import { UserRole, UserStatus } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';

/**
 * SEED DE DEMOSTRACION DE DCREDITS.
 *
 * Deja el sistema listo para levantar:
 *  1. Catalogo de modulos (dashboard, calendar, events, ...).
 *  2. Cuenta administradora de demostracion (admin@dcredits.demo).
 *  3. Matriz de permisos de cada usuario segun el preset de su rol.
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada. No pisa los
 * permisos que ya existan, de modo que los ajustes manuales se conservan.
 *
 * NO borra datos existentes.
 *
 * La contrasena se guarda como hash scrypt: nunca en claro.
 */

const prisma = createPrismaClient();

// ---------------------------------------------------------------------------
// SEED
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // --- Modulos --------------------------------------------------------------
  for (const name of MODULE_NAMES) {
    await prisma.module.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  const modules = await prisma.module.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // --- Usuario demo ---------------------------------------------------------
  // `upsert` por correo: si ya existe no se toca su contrasena ni su rol.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dcredits.demo' },
    create: {
      fullName: 'Ana Torres',
      email: 'admin@dcredits.demo',
      passwordHash: hashPassword('admin123'),
      mustChangePassword: false,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      professionalSchool: '',
    },
    update: {},
  });

  // --- Matriz de permisos ---------------------------------------------------
  // Rellena solo las cuentas que aun no tengan filas (por ejemplo, las creadas
  // antes de existir la tabla de permisos).
  let permissionsCreated = 0;
  const users = await prisma.user.findMany({ select: { id: true, role: true } });

  for (const user of users) {
    const existing = await prisma.userModulePermission.count({
      where: { userId: user.id },
    });

    if (existing > 0) {
      continue;
    }

    const result = await prisma.userModulePermission.createMany({
      data: modules.map((module) => ({
        userId: user.id,
        moduleId: module.id,
        permission: defaultPermission(user.role, module.name),
      })),
      skipDuplicates: true,
    });

    permissionsCreated += result.count;
  }

  // --- Resumen --------------------------------------------------------------
  const totalModules = await prisma.module.count();
  const totalUsers = await prisma.user.count();
  const totalPermissions = await prisma.userModulePermission.count();

  console.log('Seed de demostracion de DCredits completado:');
  console.log(`  modulos en la base    : ${totalModules}`);
  console.log(`  usuarios en la base   : ${totalUsers}`);
  console.log(`  permisos insertados   : ${permissionsCreated}`);
  console.log(`  permisos en la base   : ${totalPermissions}`);
  console.log(`  administrador demo    : ${admin.email}`);
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error('Seed de demostracion fallido:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
