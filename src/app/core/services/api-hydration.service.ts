import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { mapApiEvent, mapApiParticipation, mapApiStudent } from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { DataModeService } from './data-mode.service';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';

/**
 * HIDRATACION INICIAL DESDE EL API.
 *
 * Carga eventos, estudiantes y participaciones del backend y reemplaza el
 * contenido de los servicios de dominio. Los componentes siguen leyendo signals
 * sincronos: no saben si el origen es el API o el mock.
 *
 * Es todo-o-nada: solo se reemplaza si las tres lecturas responden. Ante
 * cualquier fallo (API apagado, red, 500) se conservan los mocks, de modo que la
 * aplicacion nunca queda vacia. `dataMode` expone de donde salieron los datos.
 */
@Injectable({ providedIn: 'root' })
export class ApiHydrationService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);

  private started = false;

  async hydrate(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    try {
      const { events, students, participations } = await firstValueFrom(
        forkJoin({
          events: this.api.listEvents(),
          students: this.api.listStudents(),
          participations: this.api.listParticipations(),
        })
      );

      this.eventService.replaceAll(events.map(mapApiEvent));
      this.studentService.replaceAll(students.map(mapApiStudent));
      this.participationService.replaceAll(participations.map(mapApiParticipation));
      this.dataMode.source.set('api');
    } catch {
      // Sin API se mantiene el contenido mock ya cargado por cada servicio.
      this.dataMode.source.set('mock');
    }
  }
}
