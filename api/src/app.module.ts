import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { EventsModule } from './modules/events/events.module';
import { ParticipationsModule } from './modules/participations/participations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StudentsModule } from './modules/students/students.module';
import { VerificationModule } from './modules/verification/verification.module';

/**
 * API de DCredits.
 *
 * Superficie:
 *   /students        padron maestro, facetas e import incremental
 *   /events          eventos academicos y sus participantes
 *   /participations  participaciones, edicion y carga masiva
 *   /verification    consulta de un codigo DCredits
 *   /reports         cifras del inicio y creditos por escuela
 *
 * Alcance de esta fase: PostgreSQL -> Prisma -> NestJS.
 * No hay autenticacion, roles, JWT ni permisos todavia.
 */
@Module({
  imports: [
    PrismaModule,
    StudentsModule,
    EventsModule,
    ParticipationsModule,
    VerificationModule,
    ReportsModule,
  ],
})
export class AppModule {}