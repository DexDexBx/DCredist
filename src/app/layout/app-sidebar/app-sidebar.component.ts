import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ModuleKey, PermissionLevel } from '../../models/permission.model';
import { SidebarService } from '../../core/services/sidebar.service';
import { IconComponent, IconName } from '../../shared/components/ui/icon/icon.component';

interface NavItem {
  label: string;
  path: string;
  /**
   * Prefijo que marca la opcion como activa.
   *
   * Permite que "Eventos" siga resaltado en /events/new o /events/12, pero que
   * el calendario (/events/calendar) marque su propia entrada.
   */
  matchPath: string;
  icon: IconName;
  /** Modulo del que depende la opcion. */
  module: ModuleKey;
  /** Nivel minimo del modulo para mostrarla en el menu. */
  level: PermissionLevel;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, IconComponent],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  readonly sidebarService = inject(SidebarService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Ruta actual sin query params ni fragmento. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly allSections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', path: '/', matchPath: '/', icon: 'dashboard', module: 'dashboard', level: 'VIEW' },
        {
          label: 'Calendario',
          path: '/events/calendar',
          matchPath: '/events/calendar',
          icon: 'calendar',
          module: 'calendar',
          level: 'VIEW',
        },
        { label: 'Eventos', path: '/events', matchPath: '/events', icon: 'event', module: 'events', level: 'VIEW' },
      ],
    },
    {
      title: 'Participación',
      items: [
        { label: 'Estudiantes', path: '/students', matchPath: '/students', icon: 'users', module: 'students', level: 'VIEW' },
        {
          label: 'Participaciones',
          path: '/participations',
          matchPath: '/participations',
          icon: 'event',
          module: 'participations',
          level: 'VIEW',
        },
        {
          label: 'Códigos de certificado',
          path: '/certificates/codes',
          matchPath: '/certificates',
          icon: 'key',
          module: 'certificates',
          level: 'VIEW',
        },
        {
          label: 'Verificar código',
          path: '/verify',
          matchPath: '/verify',
          icon: 'shield-check',
          module: 'verification',
          level: 'VIEW',
        },
      ],
    },
    {
      title: 'Administración',
      items: [
        {
          label: 'Usuarios y perfiles',
          path: '/users',
          matchPath: '/users',
          icon: 'settings',
          module: 'users',
          level: 'VIEW',
        },
        {
          label: 'Catálogos',
          path: '/catalogs/organizers',
          matchPath: '/catalogs',
          icon: 'building',
          module: 'catalogs',
          level: 'VIEW',
        },
      ],
    },
  ];

  readonly sections = computed<NavSection[]>(() =>
    this.allSections
      .map((section) => ({
        title: section.title,
        items: section.items.filter((item) => this.auth.can(item.module, item.level)),
      }))
      .filter((section) => section.items.length > 0),
  );

  /**
   * Entrada del menu que corresponde a la ruta actual.
   *
   * Gana el prefijo mas especifico: asi /events/calendar resalta "Calendario"
   * y no "Eventos", y /events/12 resalta "Eventos".
   */
  private readonly activePath = computed<string | null>(() => {
    const path = this.currentPath();
    let active: string | null = null;
    let activeLength = -1;

    for (const section of this.sections()) {
      for (const item of section.items) {
        if (!this.matches(item.matchPath, path) || item.matchPath.length <= activeLength) {
          continue;
        }

        active = item.path;
        activeLength = item.matchPath.length;
      }
    }

    return active;
  });

  isActive(item: NavItem): boolean {
    return this.activePath() === item.path;
  }

  onMouseEnter(): void {
    this.sidebarService.setHovered(true);
  }

  onMouseLeave(): void {
    this.sidebarService.setHovered(false);
  }

  onNavigate(): void {
    this.sidebarService.closeMobile();
  }

  private currentPath(): string {
    return this.currentUrl().split('?')[0].split('#')[0];
  }

  private matches(matchPath: string, path: string): boolean {
    // El dashboard es la raiz: sin esta excepcion marcaria todas las rutas.
    if (matchPath === '/') {
      return path === '/';
    }

    return path === matchPath || path.startsWith(`${matchPath}/`);
  }
}
