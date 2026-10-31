import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import {
  mapApiEvent,
  mapApiParticipation,
  mapApiStudent,
  mapApiUser,
} from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { AuthService } from './auth.service';
import { DataModeService } from './data-mode.service';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';
import { UserService } from './user.service';

/**
 * HIDRATACION INICIAL DESDE EL API.
 *
 * Carga eventos, estudiantes, participaciones y usuarios del backend y
 * reemplaza el contenido de los servicios de dominio. Los componentes siguen
 * leyendo signals sincronos: no saben si el origen es el API o el estado local.
 *
 * Es todo-o-nada: solo se reemplaza si las cuatro lecturas responden. Ante
 * cualquier fallo (API apagado, red, 500) los servicios conservan el estado
 * local de la sesion, que arranca vacio. `dataMode` expone de donde salieron
 * los datos.
 */
@Injectable({ providedIn: 'root' })
export class ApiHydrationService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly auth = inject(AuthService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);
  private readonly userService = inject(UserService);

  private started = false;

  async hydrate(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    try {
      const { events, students, participations, users } = await firstValueFrom(
        forkJoin({
          events: this.api.listEvents(),
          students: this.api.listStudents(),
          participations: this.api.listParticipations(),
          users: this.api.listUsers(),
        })
      );

      this.eventService.replaceAll(events.map(mapApiEvent));
      this.studentService.replaceAll(students.map(mapApiStudent));
      this.participationService.replaceAll(participations.map(mapApiParticipation));
      this.userService.replaceAll(users.map(mapApiUser));
      this.dataMode.source.set('api');
    } catch {
      // Sin API se mantiene el estado local (vacio al arrancar).
      this.dataMode.source.set('local');
    }

    // Con el API disponible, refresca el perfil y la matriz de la sesión antes
    // de la navegación inicial: un cambio de rol o de permisos hecho desde otra
    // cuenta se refleja al recargar, sin cerrar sesión.
    if (this.dataMode.isApi) {
      await this.auth.revalidateSession();
    }
  }
}
