import { Module } from '@nestjs/common';
import { ParticipationsModule } from '../participations/participations.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  // El historial de participaciones vive en ParticipationsService: los
  // estudiantes no mantienen una segunda copia de esa logica.
  imports: [ParticipationsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
