import { Component, computed, input, signal } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

@Component({
  selector: 'dc-panel',
  imports: [IconComponent],
  templateUrl: './panel.component.html',
  host: { class: 'block' },
})
export class PanelComponent {
  readonly title = input<string>('');
  readonly subtitle = input<string>('');
  /** Icono opcional del encabezado (de la coleccion de iconos del proyecto). */
  readonly icon = input<IconName>();
  /** Permite plegar/desplegar el cuerpo del panel. */
  readonly collapsible = input<boolean>(false);
  /** Reemplaza el padding por defecto del cuerpo cuando se informa. */
  readonly bodyClass = input<string>('');

  /** Estado de plegado. Arranca desplegado. */
  readonly collapsed = signal(false);

  readonly bodyClasses = computed(() => this.bodyClass() || 'px-5 py-5');

  toggle(): void {
    this.collapsed.update((value) => !value);
  }
}
