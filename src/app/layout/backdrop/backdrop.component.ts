import { Component, inject } from '@angular/core';
import { SidebarService } from '../../core/services/sidebar.service';

@Component({
  selector: 'app-backdrop',
  template: `
    @if (sidebarService.isMobileOpen()) {
    <button
      type="button"
      class="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-[2px] xl:hidden"
      (click)="closeSidebar()"
      aria-label="Cerrar menú lateral"
    ></button>
    }
  `,
})
export class BackdropComponent {
  readonly sidebarService = inject(SidebarService);

  closeSidebar(): void {
    this.sidebarService.closeMobile();
  }
}
