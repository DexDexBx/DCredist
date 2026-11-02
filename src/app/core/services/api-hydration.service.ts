import { Injectable, inject } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import {
  mapApiEvent,
  mapApiParticipation,
  mapApiStudent,
  mapApiUser,
} from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { readSessionUserId } from '../auth/session-storage';
import { AuthService } from './auth.service';
import { CatalogService } from './catalog.service';
import { DataModeService } from './data-mode.service';
import { EventService } from './event.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';
import { UserService } from './user.service';

/**
 * HIDRATACION DESDE EL API.
 *
 * Carga catalogos, eventos, estudiantes, participaciones y usuarios del backend
 * y reemplaza el contenido de los servicios de dominio. Los componentes siguen
 * leyendo signals sincronos: no saben si el origen es el API o el estado local.
 *
 * El API exige `X-User-Id`, asi que sin sesion no se consulta nada: la
 * hidratacion de datos corre despues del login (`refresh()`).
 *
 * Es todo-o-nada para los datos de negocio: solo se reemplazan si las cuatro
 * lecturas responden. Ante cualquier fallo (API apagado, red, 500) los servicios
 * conservan el estado local de la sesion, que arranca vacio.
 */
@Injectable({ providedIn: 'root' })
export class ApiHydrationService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);
  private readonly userService = inject(UserService);

  private started = false;

  /** Arranque de la aplicacion: revalida la sesion guardada y carga sus datos. */
  async hydrate(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!readSessionUserId()) {
      // Todavia no hay sesion: el login se encarga de llamar a refresh().
      this.dataMode.source.set('local');
      return;
    }

    await this.refresh();
    await this.auth.revalidateSession();
  }

  /** Recarga todos los datos con la sesion activa. Tambien corre tras el login. */
  async refresh(): Promise<void> {
    if (!readSessionUserId()) {
      this.dataMode.source.set('local');
      return;
    }

    try {
      const [{ events, students, participations, users }] = await Promise.all([
        firstValueFrom(
          forkJoin({
            events: this.api.listEvents(),
            students: this.api.listStudents(),
            participations: this.api.listParticipations(),
            users: this.api.listUsers(),
          })
        ),
        this.catalogService.loadAll(),
      ]);

      this.eventService.replaceAll(events.map(mapApiEvent));
      this.studentService.replaceAll(students.map(mapApiStudent));
      this.participationService.replaceAll(participations.map(mapApiParticipation));
      this.userService.replaceAll(users.map(mapApiUser));
      this.dataMode.source.set('api');
    } catch {
      // Sin API se mantiene el estado local (vacio al arrancar).
      this.dataMode.source.set('local');
    }
  }
}
