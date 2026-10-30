import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  ModuleKey,
  PermissionLevel,
  PermissionMap,
  ROLE_DEFAULT_PERMISSIONS,
  permissionAtLeast,
} from '../../models/permission.model';
import { ROLE_DESCRIPTIONS, UserProfile } from '../../models/user.model';
import { initialsOf } from '../../shared/utils/text.utils';
import { ApiLoginResponse } from '../api/api.types';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { UserService } from './user.service';

const SESSION_STORAGE_KEY = 'dcredits-session';
const PERMISSIONS_STORAGE_KEY = 'dcredits-permissions';

/** Sobrescrituras por usuario: `userId -> modulo -> nivel ajustado`. */
type PermissionOverrides = Record<string, Partial<PermissionMap>>;

/**
 * Sesión y permisos.
 *
 * El login valida correo + contraseña contra `POST /auth/login`, que compara la
 * contraseña con su hash scrypt en la tabla `users`. El perfil devuelto se
 * conserva en localStorage para restaurar la sesión al recargar. Los ajustes de
 * acceso por usuario también viven en localStorage mientras no exista su API.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(DcreditsApiClient);
  private readonly userService = inject(UserService);

  private readonly currentUserState = signal<UserProfile | null>(this.restoreSession());
  private readonly overridesState = signal<PermissionOverrides>(this.restoreOverrides());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);
  readonly isAdmin = computed(() => this.currentUserState()?.role === 'ADMIN');

  async login(email: string, password: string): Promise<boolean> {
    try {
      const user = await firstValueFrom(
        this.api.login(email.trim().toLowerCase(), password)
      );

      if (user.status !== 'ACTIVE') {
        return false;
      }

      this.setSession(this.toProfile(user));
      return true;
    } catch {
      return false;
    }
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

  private setSession(profile: UserProfile): void {
    this.currentUserState.set(profile);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
    }
  }

  private restoreSession(): UserProfile | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    try {
      const profile = JSON.parse(stored) as UserProfile;
      return profile && typeof profile.id === 'string' && typeof profile.email === 'string'
        ? profile
        : null;
    } catch {
      return null;
    }
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

  private toProfile(account: ApiLoginResponse): UserProfile {
    return {
      id: account.id,
      fullName: account.fullName,
      email: account.email,
      role: account.role,
      status: account.status,
      initials: initialsOf(account.fullName),
      description: ROLE_DESCRIPTIONS[account.role],
    };
  }
}
