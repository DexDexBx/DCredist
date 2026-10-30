import 'dotenv/config';
import { hashPassword } from '../src/common/password';
import { UserRole, UserStatus } from '../src/generated/prisma/client';
import { createPrismaClient } from '../src/common/prisma/prisma-client-factory';

/**
 * SEED DE USUARIOS DE DCREDITS.
 *
 * Solo siembra la tabla `users`:
 *  - 1 cuenta administradora de demostracion (admin@dcredits.demo).
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada, porque el
 * usuario se inserta con `createMany({ skipDuplicates: true })` sobre su correo.
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
  // --- Usuarios -------------------------------------------------------------
  // Cuenta de demostracion del frontend para el login.
  const demoUsers = [
    {
      fullName: 'Ana Torres',
      email: 'admin@dcredits.demo',
      password: 'admin123',
      role: UserRole.ADMIN,
      professionalSchool: '',
    },
  ];

  const userRows = [
    ...demoUsers.map((user) => ({
      fullName: user.fullName,
      email: user.email,
      passwordHash: hashPassword(user.password),
      mustChangePassword: false,
      role: user.role,
      status: UserStatus.ACTIVE,
      professionalSchool: user.professionalSchool,
    })),
  ];

  const usersCreated = await prisma.user.createMany({
    data: userRows,
    skipDuplicates: true,
  });

  // --- Resumen --------------------------------------------------------------
  const totalUsers = await prisma.user.count();

  console.log('Seed de usuarios de DCredits completado:');
  console.log(`  usuarios insertados : ${usersCreated.count}`);
  console.log(`  usuarios en la base : ${totalUsers}`);
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
