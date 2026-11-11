import { Component, HostListener, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiActivityService } from '../../core/services/api-activity.service';
import { ApiHydrationService } from '../../core/services/api-hydration.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';
import { BackdropComponent } from '../backdrop/backdrop.component';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AppHeaderComponent, AppSidebarComponent, BackdropComponent],
  templateUrl: './app-layout.component.html',
})
export class AppLayoutComponent {
  readonly sidebarService = inject(SidebarService);
  readonly hydration = inject(ApiHydrationService);
  readonly apiActivity = inject(ApiActivityService);

  /** Bloquea solo durante la carga de un modulo completo. */
  readonly showHydrationOverlay = computed(() => this.hydration.busy());

  /** La barra superior aparece con cualquier peticion al API. */
  readonly showApiProgress = computed(
    () => this.hydration.hydrating() || this.apiActivity.active()
  );

  /**
   * El panel movil solo existe por debajo de `xl`.
   *
   * Al volver a una pantalla grande se cierra para que, si la ventana se
   * reduce otra vez, no aparezca abierto encima del contenido.
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    if (window.innerWidth >= 1280) {
      this.sidebarService.closeMobile();
    }
  }
}
