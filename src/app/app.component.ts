import { Component, computed, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  Router,
  RouterModule,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { ThemeService } from './core/services/theme.service';
import { LoadingStateComponent } from './shared/components/ui/loading-state/loading-state.component';

/**
 * RAIZ DE DCREDITS.
 *
 * Mientras el router resuelve la primera navegacion (guards de sesion y de
 * datos por modulo) se muestra una pantalla de carga. Sin ella, al recargar o
 * abrir una pestaña directa en un modulo se veia un fondo vacio hasta que
 * llegaban los datos del API.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule, LoadingStateComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'DCredits';

  /**
   * Se inyecta aqui para que el tema se aplique incluso mientras se muestra el
   * splash y el header aun no existe. La eleccion inicial ya la adelanta el
   * script de index.html antes del primer pintado.
   */
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly firstNavigationDone = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError
      ),
      map(() => true)
    ),
    { initialValue: false }
  );

  /** Splash solo en la primera navegacion; después mandan los loaders de cada pantalla. */
  readonly showSplash = computed(() => !this.firstNavigationDone());
}
