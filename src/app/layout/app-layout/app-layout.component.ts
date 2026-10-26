import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
}
