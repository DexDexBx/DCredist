import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/ui/icon/icon.component';

@Component({
  selector: 'auth-page-layout',
  imports: [RouterLink, IconComponent],
  templateUrl: './auth-page-layout.component.html',
})
export class AuthPageLayoutComponent {
  readonly themeService = inject(ThemeService);

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
