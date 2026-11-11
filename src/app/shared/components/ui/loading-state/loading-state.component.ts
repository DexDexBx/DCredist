import { Component, input } from '@angular/core';

/**
 * ESTADO DE CARGA REUTILIZABLE.
 *
 * Se usa en la pantalla de arranque y dentro de las tablas mientras llegan los
 * datos del API. No reemplaza a los loaders de importacion: solo comunica que
 * una consulta esta en curso.
 */
@Component({
  selector: 'dc-loading-state',
  template: `
    <div class="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span
        class="size-9 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-brand-500/20 dark:border-t-brand-400"
        aria-hidden="true"
      ></span>
      @if (label()) {
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ label() }}</p>
      }
    </div>
  `,
})
export class LoadingStateComponent {
  /** Texto que acompana al indicador. */
  readonly label = input('Cargando…');
}
