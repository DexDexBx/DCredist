import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import {
  MODULES,
  ModuleKey,
  PERMISSION_LEVEL_LABEL,
  PermissionLevel,
  PermissionMap,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../../../models/permission.model';
import {
  ALL_USER_ROLES,
  DemoUserAccount,
  ROLE_LABELS,
  ROLE_SHORT_LABELS,
  USER_STATUS_LABEL,
  UserProfile,
  UserRole,
  UserStatus,
} from '../../../../models/user.model';
import {
  BadgeColor,
  BadgeComponent,
} from '../../../../shared/components/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

const ALL_STATUSES: readonly UserStatus[] = ['ACTIVE', 'INACTIVE'];

/**
 * PERFILES Y ACCESOS.
 *
 * Los perfiles son cuentas mock. Los accesos se ajustan por usuario y por
 * modulo (sin acceso, solo ver, gestionar) y quedan guardados en la sesion de
 * demostracion. La API sustituira esta persistencia sin cambiar la pantalla.
 */
@Component({
  selector: 'app-user-list',
  imports: [
    BadgeComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    ModalComponent,
    NgClass,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    RouterLink,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  readonly directory = this.userService.users;
  readonly currentUser = this.auth.currentUser;
  readonly roleLabels = ROLE_LABELS;
  readonly roleShortLabels = ROLE_SHORT_LABELS;
  readonly roles = ALL_USER_ROLES;
  readonly statuses = ALL_STATUSES;
  readonly statusLabel = USER_STATUS_LABEL;

  readonly modules = MODULES;
  readonly levels: PermissionLevel[] = ['NONE', 'VIEW', 'MANAGE'];
  readonly levelLabel = PERMISSION_LEVEL_LABEL;
  readonly defaultPermissions = ROLE_DEFAULT_PERMISSIONS;

  readonly search = signal('');
  readonly roleFilter = signal<UserRole | 'Todos'>('Todos');
  readonly statusFilter = signal<UserStatus | 'Todos'>('Todos');
  readonly pageSize = signal(25);
  readonly page = linkedSignal({
    source: () => `${this.search()}|${this.roleFilter()}|${this.statusFilter()}|${this.pageSize()}`,
    computation: () => 1,
  });

  /** Cifras por perfil sobre el directorio completo, para ver el reparto de golpe. */
  readonly roleCounts = computed(() => {
    const counts: Record<UserRole, number> = { ADMIN: 0, COORDINATOR: 0, OPERATOR: 0, VIEWER: 0 };
    for (const user of this.directory()) {
      counts[user.role] += 1;
    }
    return counts;
  });

  /** Usuario cuyo acceso se esta configurando en el modal. */
  readonly configuringUserId = signal<string | null>(null);

  /** Borrador del modal: se edita aqui y se aplica al guardar. */
  readonly draft = signal<PermissionMap | null>(null);

  readonly editingUser = computed(() => {
    const id = this.configuringUserId();
    return id ? (this.directory().find((user) => user.id === id) ?? null) : null;
  });

  /** Usuarios que pasan los filtros de búsqueda, rol y estado. */
  readonly filteredUsers = computed(() => {
    const term = this.search().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.directory().filter((user) => {
      if (role !== 'Todos' && user.role !== role) {
        return false;
      }
      if (status !== 'Todos' && user.status !== status) {
        return false;
      }
      if (!term) {
        return true;
      }
      return (
        user.fullName.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      );
    });
  });

  readonly pageData = computed(() => {
    const items = this.filteredUsers();
    const total = items.length;
    const pageSize = this.pageSize();
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, this.page()), pageCount);
    const start = (current - 1) * pageSize;

    return {
      items: items.slice(start, start + pageSize),
      total,
      page: current,
      pageCount,
      from: total === 0 ? 0 : start + 1,
      to: Math.min(total, start + pageSize),
      pageSize,
    };
  });

  readonly hasFilters = computed(
    () => this.search().trim() !== '' || this.roleFilter() !== 'Todos' || this.statusFilter() !== 'Todos',
  );

  readonly hasChanges = computed(() => {
    const user = this.editingUser();
    const draft = this.draft();
    if (!user || !draft) {
      return false;
    }

    const current = this.auth.effectivePermissions(user);
    return this.modules.some((module) => current[module.key] !== draft[module.key]);
  });

  /** Cuantos modulos quedan en cada nivel, segun lo cargado en el modal. */
  readonly editingSummary = computed(() => {
    const user = this.editingUser();
    if (!user) {
      return null;
    }

    const current = this.draft() ?? this.auth.effectivePermissions(user);
    return this.levels.map((level) => ({
      level,
      count: this.modules.filter((module) => current[module.key] === level).length,
    }));
  });

  /**
   * El modulo de usuarios de la sesion activa queda bloqueado: quitarlo dejaria
   * al administrador sin forma de volver a conceder accesos.
   */
  isLocked(user: UserProfile, module: ModuleKey): boolean {
    return this.isCurrent(user) && module === 'users';
  }

  defaultLevel(role: UserRole, module: ModuleKey): PermissionLevel {
    return ROLE_DEFAULT_PERMISSIONS[role][module];
  }

  editingLevel(module: ModuleKey): PermissionLevel {
    const draft = this.draft();
    if (draft) {
      return draft[module];
    }

    const user = this.editingUser();
    return user ? this.auth.effectivePermissions(user)[module] : 'NONE';
  }

  isOverridden(user: UserProfile, module: ModuleKey): boolean {
    return this.auth.isOverridden(user.id, module);
  }

  overrideCount(user: UserProfile): number {
    return this.modules.filter((module) => this.auth.isOverridden(user.id, module.key)).length;
  }

  badgeColor(role: UserRole): BadgeColor {
    const colors: Record<UserRole, BadgeColor> = {
      ADMIN: 'primary',
      COORDINATOR: 'info',
      OPERATOR: 'success',
      VIEWER: 'light',
    };

    return colors[role];
  }

  openPermissions(user: UserProfile): void {
    this.configuringUserId.set(user.id);
    this.draft.set({ ...this.auth.effectivePermissions(user) });
  }

  closePermissions(): void {
    this.configuringUserId.set(null);
    this.draft.set(null);
  }

  setLevel(module: ModuleKey, level: PermissionLevel): void {
    const user = this.editingUser();
    const draft = this.draft();
    if (!user || !draft || this.isLocked(user, module)) {
      return;
    }

    this.draft.set({ ...draft, [module]: level });
  }

  restoreRoleDefaults(): void {
    const user = this.editingUser();
    if (!user) {
      return;
    }

    this.draft.set({ ...ROLE_DEFAULT_PERMISSIONS[user.role] });
  }

  savePermissions(): void {
    const user = this.editingUser();
    const draft = this.draft();
    if (!user || !draft) {
      return;
    }

    const current = this.auth.effectivePermissions(user);
    for (const module of this.modules) {
      if (current[module.key] !== draft[module.key]) {
        this.auth.setPermission(user.id, module.key, draft[module.key]);
      }
    }

    this.closePermissions();
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onRoleChange(event: Event): void {
    this.roleFilter.set((event.target as HTMLSelectElement).value as UserRole | 'Todos');
  }

  onStatusChange(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as UserStatus | 'Todos');
  }

  clearFilters(): void {
    this.search.set('');
    this.roleFilter.set('Todos');
    this.statusFilter.set('Todos');
  }

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
  }

  canSignIn(user: UserProfile): boolean {
    return user.status === 'ACTIVE';
  }

  signInAs(user: UserProfile): void {
    if (this.isCurrent(user)) {
      return;
    }

    void this.router.navigateByUrl('/signin');
  }

  isCurrent(user: UserProfile): boolean {
    return this.currentUser()?.id === user.id;
  }
}
