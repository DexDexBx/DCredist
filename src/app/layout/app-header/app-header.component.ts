import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataModeService } from '../../core/services/data-mode.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/ui/icon/icon.component';
import { NotificationMenuComponent } from '../../shared/components/common/notification-menu/notification-menu.component';
import { UserMenuComponent } from '../../shared/components/common/user-menu/user-menu.component';

@Component({
  selector: 'app-header',
  imports: [IconComponent, NotificationMenuComponent, UserMenuComponent],
  templateUrl: './app-header.component.html',
})
export class AppHeaderComponent {
  readonly sidebarService = inject(SidebarService);
  readonly themeService = inject(ThemeService);
  readonly dataMode = inject(DataModeService);
  private readonly router = inject(Router);

  onToggleSidebar(): void {
    if (window.innerWidth >= 1280) {
      this.sidebarService.toggleExpanded();
    } else {
      this.sidebarService.toggleMobileOpen();
    }
  }

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }

  onBrandClick(): void {
    void this.router.navigateByUrl('/');
  }
}
