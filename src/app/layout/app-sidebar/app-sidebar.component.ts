import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ModuleKey, PermissionLevel } from '../../models/permission.model';
import { SidebarService } from '../../core/services/sidebar.service';
import { IconComponent, IconName } from '../../shared/components/ui/icon/icon.component';

interface NavItem {
  label: string;
  path: string;
  icon: IconName;
  exact: boolean;
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
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent {
  readonly sidebarService = inject(SidebarService);
  private readonly auth = inject(AuthService);

  private readonly allSections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Dashboard', path: '/', icon: 'dashboard', exact: true, module: 'dashboard', level: 'VIEW' },
        { label: 'Calendario', path: '/events/calendar', icon: 'calendar', exact: false, module: 'calendar', level: 'VIEW' },
        { label: 'Eventos', path: '/events', icon: 'event', exact: true, module: 'events', level: 'VIEW' },
      ],
    },
    {
      title: 'Participación',
      items: [
        { label: 'Estudiantes', path: '/students', icon: 'users', exact: true, module: 'students', level: 'VIEW' },
        { label: 'Participaciones', path: '/participations', icon: 'event', exact: true, module: 'participations', level: 'VIEW' },
        {
          label: 'Registrar participación',
          path: '/participations/register',
          icon: 'user-plus',
          exact: true,
          module: 'participations',
          level: 'MANAGE',
        },
        {
          label: 'Códigos de certificado',
          path: '/certificates/codes',
          icon: 'key',
          exact: true,
          module: 'certificates',
          level: 'VIEW',
        },
        { label: 'Verificar código', path: '/verify', icon: 'shield-check', exact: true, module: 'verification', level: 'VIEW' },
      ],
    },
    {
      title: 'Administración',
      items: [
        {
          label: 'Usuarios y perfiles',
          path: '/users',
          icon: 'settings',
          exact: true,
          module: 'users',
          level: 'VIEW',
        },
        {
          label: 'Catálogos',
          path: '/catalogs/organizers',
          icon: 'building',
          exact: true,
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

  onMouseEnter(): void {
    this.sidebarService.setHovered(true);
  }

  onMouseLeave(): void {
    this.sidebarService.setHovered(false);
  }

  onNavigate(): void {
    this.sidebarService.closeMobile();
  }
}
