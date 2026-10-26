import { Component, signal } from '@angular/core';
import { IconComponent } from '../../ui/icon/icon.component';

/**
 * Encabezado de notificaciones. Solo interfaz: no hay fuente de datos real
 * hasta que exista la API de DCredits.
 */
@Component({
  selector: 'dc-notification-menu',
  imports: [IconComponent],
  templateUrl: './notification-menu.component.html',
})
export class NotificationMenuComponent {
  readonly open = signal(false);

  toggle(): void {
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }
}
