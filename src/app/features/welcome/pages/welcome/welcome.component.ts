import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ThemeService } from '../../../../core/services/theme.service';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

/**
 * PORTAL DE BIENVENIDA.
 *
 * Pantalla publica de entrada a DCredits. Permite elegir entre el acceso
 * estudiantil (todavia en preparacion) y el acceso administrativo que lleva al
 * inicio de sesion existente.
 */
@Component({
  selector: 'app-welcome',
  imports: [RouterLink, IconComponent],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  private readonly route = inject(ActivatedRoute);
  readonly themeService = inject(ThemeService);

  /** Ruta que la persona intentaba abrir antes de ser enviada al acceso. */
  readonly redirect = this.route.snapshot.queryParamMap.get('redirect');
  readonly redirectParams = this.redirect ? { redirect: this.redirect } : {};

  onToggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
