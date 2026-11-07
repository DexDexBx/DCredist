import 'dotenv/config';
import { hashPassword } from '../src/common/password';
import { defaultPermission, MODULE_NAMES } from '../src/common/permissions';
import { CatalogStatus, UserRole, UserStatus } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';
import { seedAcademicDemo } from './demo-data';

/**
 * SEED DE DEMOSTRACION DE DCREDITS.
 *
 * Deja el sistema listo para levantar:
 *  1. Catalogo de modulos (dashboard, calendar, events, ...).
 *  2. Escuela `general` y cuenta administradora (admin@dcredits.demo).
 *  3. Matriz de permisos de cada usuario segun el preset de su rol.
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
  // --- Roles ----------------------------------------------------------------
  // La tabla roles reemplaza al enum como fuente de verdad de la relacion.
  // Se cargan los mismos nombres que ya conoce el codigo.
  const roleNames = [
    UserRole.ADMIN,
    UserRole.COORDINATOR,
    UserRole.ORGANIZER,
    UserRole.OPERATOR,
    UserRole.VIEWER,
  ] as const;
  const roleIds = new Map<UserRole, number>();

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {},
      select: { id: true },
    });
    roleIds.set(name, role.id);
  }

  // --- Modulos --------------------------------------------------------------
  for (const name of MODULE_NAMES) {
    await prisma.module.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  // El modulo de certificados ya no forma parte de DCredits V1. Se elimina de
  // las bases antiguas; sus permisos caen en cascada.
  await prisma.module.deleteMany({ where: { name: 'certificates' } });

  const modules = await prisma.module.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  // --- Escuela general ------------------------------------------------------
  // `general` identifica a las cuentas globales: pueden operar sobre todas las
  // escuelas. Es la primera fila del catalogo y se crea antes que el usuario.
  const generalSchool = await prisma.professionalSchool.upsert({
    where: { name: 'general' },
    create: {
      name: 'general',
      status: CatalogStatus.ACTIVE,
    },
    update: {},
  });

  // --- Usuario demo ---------------------------------------------------------
  // `upsert` por correo: si ya existe no se toca su contrasena, pero se asegura
  // de que quede vinculado al rol ADMIN.
  const adminRoleId = roleIds.get(UserRole.ADMIN)!;
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dcredits.com' },
    create: {
      fullName: 'Super Admin',
      email: 'admin@dcredits.com',
      passwordHash: hashPassword('admin123'),
      mustChangePassword: false,
      roleId: adminRoleId,
      status: UserStatus.ACTIVE,
      professionalSchoolId: generalSchool.id,
    },
    update: { roleId: adminRoleId },
  });

  // --- Matriz de permisos ---------------------------------------------------
  // Rellena solo las cuentas que aun no tengan filas (por ejemplo, las creadas
  // antes de existir la tabla de permisos).
  let permissionsCreated = 0;
  const users = await prisma.user.findMany({
    select: { id: true, role: { select: { name: true } } },
  });

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
        permission: defaultPermission(user.role.name as UserRole, module.name),
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
