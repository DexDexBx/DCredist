import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
import { EventTypeService } from './event-type.service';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';
import { UserService } from './user.service';

type LoadKey = 'reference' | 'events' | 'students' | 'participations' | 'users';

/**
 * CARGA DE DATOS POR MODULO.
 *
 * El dashboard trabaja con `/reports/dashboard` y no necesita las listas
 * completas. Cada modulo carga sus datos cuando se entra a el, con un loader
 * visible, y los conserva en memoria para que las pantallas sincronicas sigan
 * funcionando igual.
 */
@Injectable({ providedIn: 'root' })
export class ApiHydrationService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly eventService = inject(EventService);
  private readonly eventTypeService = inject(EventTypeService);
  private readonly studentService = inject(StudentService);
  private readonly participationService = inject(ParticipationService);
  private readonly userService = inject(UserService);

  private started = false;

  private readonly loaded: Record<LoadKey, boolean> = {
    reference: false,
    events: false,
    students: false,
    participations: false,
    users: false,
  };

  private readonly inFlight = new Map<LoadKey, Promise<void>>();

  readonly loadingReference = signal(false);
  readonly loadingEvents = signal(false);
  readonly loadingStudents = signal(false);
  readonly loadingParticipations = signal(false);
  readonly loadingUsers = signal(false);

  readonly busy = computed(
    () =>
      this.loadingReference() ||
      this.loadingEvents() ||
      this.loadingStudents() ||
      this.loadingParticipations() ||
      this.loadingUsers()
  );

  readonly hydrated = signal(false);
  readonly hydrating = this.busy;

  /** Arranque: valida sesion y deja listos solo catalogos y tipos de evento. */
  async hydrate(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!readSessionUserId()) {
      this.dataMode.source.set('local');
      this.hydrated.set(true);
      return;
    }

    try {
      await this.ensureReferenceData();
      await this.auth.revalidateSession();
    } finally {
      this.hydrated.set(true);
    }
  }

  /** Catalogos y tipos de evento: datos pequenos compartidos por los formularios. */
  ensureReferenceData(): Promise<void> {
    return this.run('reference', this.loadingReference, async () => {
      await Promise.all([this.catalogService.loadAll(), this.eventTypeService.load()]);
    });
  }

  ensureEvents(): Promise<void> {
    return this.run('events', this.loadingEvents, async () => {
      const events = await firstValueFrom(this.api.listEvents());
      this.eventService.replaceAll(events.map(mapApiEvent));
    });
  }

  ensureStudents(): Promise<void> {
    return this.run('students', this.loadingStudents, async () => {
      const students = await firstValueFrom(this.api.listStudents());
      this.studentService.replaceAll(students.map(mapApiStudent));
    });
  }

  async ensureParticipations(): Promise<void> {
    return this.run('participations', this.loadingParticipations, async () => {
      const participations = await firstValueFrom(this.api.listParticipations());
      this.participationService.replaceAll(participations.map(mapApiParticipation));

      // El modulo de participaciones tambien resuelve nombres de estudiantes
      // fuera del padron cargado (por ejemplo, estudiantes externos).
      await this.participationService.loadStudentDirectory();
    });
  }

  ensureUsers(): Promise<void> {
    return this.run('users', this.loadingUsers, async () => {
      const users = await firstValueFrom(this.api.listUsers());
      this.userService.replaceAll(users.map(mapApiUser));
    });
  }

  /** Fuerza recarga de un modulo (por ejemplo, despues de una importacion). */
  async refreshModule(key: LoadKey): Promise<void> {
    this.loaded[key] = false;

    switch (key) {
      case 'events':
        return this.ensureEvents();
      case 'students':
        return this.ensureStudents();
      case 'participations':
        return this.ensureParticipations();
      case 'users':
        return this.ensureUsers();
      default:
        return this.ensureReferenceData();
    }
  }

  /**
   * Compatibilidad con el login anterior: carga solo datos de referencia.
   * Los modulos pesados se cargan al entrar a su ruta.
   */
  async refresh(): Promise<void> {
    await this.ensureReferenceData();
  }

  private run(
    key: LoadKey,
    loading: ReturnType<typeof signal<boolean>>,
    task: () => Promise<void>
  ): Promise<void> {
    if (this.loaded[key]) {
      return Promise.resolve();
    }

    const current = this.inFlight.get(key);
    if (current) {
      return current;
    }

    loading.set(true);

    const promise = task()
      .then(() => {
        this.loaded[key] = true;
        this.dataMode.source.set('api');
      })
      .catch(() => {
        // Sin API se conserva el estado local actual.
        this.dataMode.source.set('local');
      })
      .finally(() => {
        loading.set(false);
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }
}
