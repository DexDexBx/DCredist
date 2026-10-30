import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { ModulesModule } from './modules/modules/modules.module';
import { ParticipationsModule } from './modules/participations/participations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';
import { VerificationModule } from './modules/verification/verification.module';

/**
 * API de DCredits.
 *
 * Superficie:
 *   /auth            inicio de sesion contra la tabla users
 *   /users           directorio de usuarios, credenciales y permisos
 *   /modules         catalogo de modulos del sistema
 *   /students        padron maestro, facetas e import incremental
 *   /events          eventos academicos y sus participantes
 *   /participations  participaciones, edicion y carga masiva
 *   /verification    consulta de un codigo DCredits
 *   /reports         cifras del inicio y creditos por escuela
 *
 * Alcance de esta fase: PostgreSQL -> Prisma -> NestJS.
 * El login valida credenciales contra la tabla users; aun no emite JWT ni
 * aplica permisos por rol en los endpoints.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ModulesModule,
    StudentsModule,
    EventsModule,
    ParticipationsModule,
    VerificationModule,
    ReportsModule,
  ],
})
export class AppModule {}