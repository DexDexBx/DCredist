import { Injectable, computed, signal } from '@angular/core';

/**
 * ACTIVIDAD DEL API.
 *
 * Lleva la cuenta de las peticiones HTTP en curso. La barra superior del layout
 * la usa para mostrar progreso en cualquier llamada al API, incluidas las
 * recargas de datos que no pasan por la hidratación por módulo (por ejemplo,
 * refrescar participaciones después de editar un evento o cargar una
 * constancia).
 *
 * No bloquea la interfaz: el overlay queda reservado a las cargas de módulo.
 */
@Injectable({ providedIn: 'root' })
export class ApiActivityService {
  private readonly pendingState = signal(0);

  /** Peticiones en curso. */
  readonly pending = this.pendingState.asReadonly();

  /** true mientras exista al menos una petición en curso. */
  readonly active = computed(() => this.pendingState() > 0);

  start(): void {
    this.pendingState.update((pending) => pending + 1);
  }

  finish(): void {
    this.pendingState.update((pending) => Math.max(0, pending - 1));
  }
}
