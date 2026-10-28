import { Injectable, computed, inject, signal } from '@angular/core';

import {
  ModuleKey,
  PermissionLevel,
  PermissionMap,
  ROLE_DEFAULT_PERMISSIONS,
  permissionAtLeast,
} from '../../models/permission.model';
import { DemoUserAccount, UserProfile } from '../../models/user.model';
import { DEMO_USERS } from './mock-data/users.mock';
import { UserService } from './user.service';

const SESSION_STORAGE_KEY = 'dcredits-demo-session';
const PERMISSIONS_STORAGE_KEY = 'dcredits-demo-permissions';

/** Sobrescrituras por usuario: `userId -> modulo -> nivel ajustado`. */
type PermissionOverrides = Record<string, Partial<PermissionMap>>;

  /**
   * Sesión y permisos.
   *
   * Valida las cuentas de `DEMO_USERS` y conserva el perfil activo y los
   * ajustes de acceso en localStorage. Preparado para conectar con la API.
   */
  @Injectable({ providedIn: 'root' })
  export class AuthService {
    private readonly userService = inject(UserService);

  private readonly currentUserState = signal<UserProfile | null>(this.restoreSession());
  private readonly overridesState = signal<PermissionOverrides>(this.restoreOverrides());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);
  readonly isAdmin = computed(() => this.currentUserState()?.role === 'ADMIN');

  login(email: string, password: string): boolean {
    const normalizedEmail = email.trim().toLowerCase();
    const account = DEMO_USERS.find(
      (user) => user.email.toLowerCase() === normalizedEmail && user.password === password,
    );

    if (!account) {
      return false;
    }

    this.setSession(account);
    return true;
  }

  logout(): void {
    this.currentUserState.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  /** Nivel efectivo de un modulo para la sesion activa. */
  permission(module: ModuleKey): PermissionLevel {
    const user = this.currentUserState();
    return user ? this.effectivePermissions(user)[module] : 'NONE';
  }

  /** true si la sesion activa alcanza el nivel minimo pedido en el modulo. */
  can(module: ModuleKey, required: PermissionLevel = 'VIEW'): boolean {
    return permissionAtLeast(this.permission(module), required);
  }

  /** Permisos efectivos de un perfil: valores por defecto + sobrescrituras. */
  effectivePermissions(user: UserProfile): PermissionMap {
    const defaults = ROLE_DEFAULT_PERMISSIONS[user.role];
    const override = this.overridesState()[user.id];
    return override ? { ...defaults, ...override } : defaults;
  }

  isOverridden(userId: string, module: ModuleKey): boolean {
    return this.overridesState()[userId]?.[module] !== undefined;
  }

  setPermission(userId: string, module: ModuleKey, level: PermissionLevel): void {
    const account = this.userService.findById(userId);
    if (!account) {
      return;
    }

    const defaults = ROLE_DEFAULT_PERMISSIONS[account.role];
    const overrides = { ...this.overridesState() };
    const userOverride = { ...(overrides[userId] ?? {}) };

    if (defaults[module] === level) {
      delete userOverride[module];
    } else {
      userOverride[module] = level;
    }

    if (Object.keys(userOverride).length === 0) {
      delete overrides[userId];
    } else {
      overrides[userId] = userOverride;
    }

    this.overridesState.set(overrides);
    this.persistOverrides(overrides);
  }

  resetPermissions(userId: string): void {
    const overrides = { ...this.overridesState() };

    if (!(userId in overrides)) {
      return;
    }

    delete overrides[userId];
    this.overridesState.set(overrides);
    this.persistOverrides(overrides);
  }

  private setSession(account: DemoUserAccount): void {
    this.currentUserState.set(this.toProfile(account));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, account.id);
    }
  }

  private restoreSession(): UserProfile | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const storedId = localStorage.getItem(SESSION_STORAGE_KEY);
    const account = DEMO_USERS.find((user) => user.id === storedId);
    return account ? this.toProfile(account) : null;
  }

  private restoreOverrides(): PermissionOverrides {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : {};
      return parsed && typeof parsed === 'object' ? (parsed as PermissionOverrides) : {};
    } catch {
      return {};
    }
  }

  private persistOverrides(overrides: PermissionOverrides): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(overrides));
  }

  private toProfile(account: DemoUserAccount): UserProfile {
    return {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      status: account.status,
      initials: account.initials,
      description: account.description,
    };
  }
}
