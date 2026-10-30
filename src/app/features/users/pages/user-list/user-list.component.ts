import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
 * Los perfiles se cargan del directorio de usuarios. Los accesos viven en la
 * base (`user_module_permissions`) y se ajustan por usuario y por módulo (sin
 * acceso, solo ver, gestionar). La tuerca pide la matriz al abrirse y la guarda
 * contra el API, de modo que cada cuenta puede diferir del resto aunque comparta
 * rol.
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

  readonly directory = this.userService.users;
  readonly currentUser = this.auth.currentUser;
  readonly roleLabels = ROLE_LABELS;
  readonly roleShortLabels = ROLE_SHORT_LABELS;
  readonly roles = ALL_USER_ROLES;
  readonly statuses = ALL_STATUSES;
  readonly statusLabel = USER_STATUS_LABEL;

  /**
   * Nombres de módulo que devuelve `GET /modules`. Mientras llegan (o si el API
   * no responde) se usa el catálogo local: las etiquetas son texto de interfaz.
   */
  private readonly moduleNames = signal<string[] | null>(null);
  readonly modules = computed(() => {
    const names = this.moduleNames();
    if (!names || names.length === 0) {
      return MODULES;
    }

    const available = new Set(names);
    return MODULES.filter((module) => available.has(module.key));
  });

  readonly levels: PermissionLevel[] = ['NONE', 'VIEW', 'MANAGE'];
  readonly levelLabel = PERMISSION_LEVEL_LABEL;

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
    const counts: Record<UserRole, number> = {
      ADMIN: 0,
      COORDINATOR: 0,
      ORGANIZER: 0,
      OPERATOR: 0,
      VIEWER: 0,
    };
    for (const user of this.directory()) {
      counts[user.role] += 1;
    }
    return counts;
  });

  /** Usuario cuyo acceso se está configurando en el modal. */
  readonly configuringUserId = signal<string | null>(null);

  /** Borrador del modal: se edita aquí y se envía al guardar. */
  readonly draft = signal<PermissionMap | null>(null);

  /** Matriz tal como está guardada: base para detectar cambios y ajustes. */
  private readonly savedPermissions = signal<PermissionMap | null>(null);

  readonly loadingPermissions = signal(false);
  readonly savingPermissions = signal(false);
  readonly permissionsError = signal<string | null>(null);

  readonly editingUser = computed(() => {
    const id = this.configuringUserId();
    return id ? (this.directory().find((user) => user.id === id) ?? null) : null;
  });

  constructor() {
    void this.loadModules();
  }

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

  /** Hay cambios sin guardar respecto a la matriz que está en la base. */
  readonly hasChanges = computed(() => {
    const saved = this.savedPermissions();
    const draft = this.draft();
    if (!saved || !draft) {
      return false;
    }

    return this.modules().some((module) => saved[module.key] !== draft[module.key]);
  });

  /** Cuántos módulos quedan en cada nivel, según lo cargado en el modal. */
  readonly editingSummary = computed(() => {
    const current = this.draft() ?? this.savedPermissions();
    if (!current) {
      return null;
    }

    return this.levels.map((level) => ({
      level,
      count: this.modules().filter((module) => current[module.key] === level).length,
    }));
  });

  /**
   * El módulo de usuarios de la sesión activa queda bloqueado: quitarlo dejaría
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

    const saved = this.savedPermissions();
    return saved ? saved[module] : 'NONE';
  }

  /** true si el módulo difiere del preset del rol del usuario editado. */
  isOverridden(module: ModuleKey): boolean {
    const user = this.editingUser();
    const saved = this.savedPermissions();
    if (!user || !saved) {
      return false;
    }

    return saved[module] !== ROLE_DEFAULT_PERMISSIONS[user.role][module];
  }

  overrideCount(user: UserProfile): number {
    return user.permissionsOverridden;
  }

  badgeColor(role: UserRole): BadgeColor {
    const colors: Record<UserRole, BadgeColor> = {
      ADMIN: 'primary',
      COORDINATOR: 'info',
      ORGANIZER: 'warning',
      OPERATOR: 'success',
      VIEWER: 'light',
    };

    return colors[role];
  }

  /** Abre la tuerca y pide la matriz del usuario: el listado no la trae. */
  async openPermissions(user: UserProfile): Promise<void> {
    this.configuringUserId.set(user.id);
    this.draft.set(null);
    this.savedPermissions.set(null);
    this.permissionsError.set(null);
    this.loadingPermissions.set(true);

    const permissions = await this.userService.getPermissions(user.id);

    // Se cerró el modal (o se abrió otro usuario) mientras llegaba la respuesta.
    if (this.configuringUserId() !== user.id) {
      return;
    }

    this.loadingPermissions.set(false);

    if (!permissions) {
      this.permissionsError.set('No se pudieron cargar los accesos. Vuelve a abrir la ventana.');
      return;
    }

    this.savedPermissions.set({ ...permissions });
    this.draft.set({ ...permissions });
  }

  closePermissions(): void {
    this.configuringUserId.set(null);
    this.draft.set(null);
    this.savedPermissions.set(null);
    this.loadingPermissions.set(false);
    this.savingPermissions.set(false);
    this.permissionsError.set(null);
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

    const defaults = { ...ROLE_DEFAULT_PERMISSIONS[user.role] };

    // El acceso propio al módulo de usuarios no se puede quitar: si el preset
    // del rol no lo incluye, se conserva el que ya tiene la sesión.
    if (this.isCurrent(user)) {
      defaults.users = this.savedPermissions()?.users ?? defaults.users;
    }

    this.draft.set(defaults);
  }

  /** Envía la matriz completa y, si es la sesión activa, la refresca. */
  async savePermissions(): Promise<void> {
    const user = this.editingUser();
    const draft = this.draft();
    if (!user || !draft || this.savingPermissions()) {
      return;
    }

    this.savingPermissions.set(true);
    this.permissionsError.set(null);

    const updated = await this.userService.updatePermissions(user.id, draft);

    this.savingPermissions.set(false);

    if (!updated) {
      this.permissionsError.set('No se pudieron guardar los accesos. Inténtalo de nuevo.');
      return;
    }

    if (this.isCurrent(user)) {
      this.auth.setPermissions(updated);
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

  isCurrent(user: UserProfile): boolean {
    return this.currentUser()?.id === user.id;
  }

  /** Catálogo de módulos del backend; si falla se mantiene el catálogo local. */
  private async loadModules(): Promise<void> {
    const names = await this.userService.listModuleNames();
    if (names && names.length > 0) {
      this.moduleNames.set(names);
    }
  }
}
