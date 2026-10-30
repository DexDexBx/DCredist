import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  ModuleKey,
  PermissionLevel,
  PermissionMap,
  permissionAtLeast,
} from '../../models/permission.model';
import { ROLE_DESCRIPTIONS, UserProfile } from '../../models/user.model';
import { initialsOf } from '../../shared/utils/text.utils';
import { mapApiPermissions } from '../api/api.mappers';
import { ApiLoginResponse } from '../api/api.types';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { UserService } from './user.service';

const SESSION_STORAGE_KEY = 'dcredits-session';

/** Resultado del inicio de sesión. `message` es el texto que se muestra al fallar. */
export interface LoginResult {
  ok: boolean;
  message?: string;
}

/**
 * SESIÓN Y PERMISOS.
 *
 * El login valida correo + contraseña contra `POST /auth/login`. El API devuelve
 * el perfil y su matriz completa de permisos; esa matriz es la fuente de verdad
 * (vive en `user_module_permissions`) y se conserva en localStorage para no
 * consultar la base en cada navegación.
 *
 * Los permisos solo se vuelven a pedir cuando cambian: al editar los accesos del
 * propio usuario o al modificar su perfil.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(DcreditsApiClient);
  private readonly userService = inject(UserService);

  private readonly currentUserState = signal<UserProfile | null>(this.restoreSession());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);
  readonly isAdmin = computed(() => this.currentUserState()?.role === 'ADMIN');

  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const user = await firstValueFrom(
        this.api.login(email.trim().toLowerCase(), password)
      );

      if (user.status !== 'ACTIVE') {
        return { ok: false, message: 'El usuario está inactivo.' };
      }

      this.setSession(this.toProfile(user));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.loginErrorMessage(error) };
    }
  }

  /**
   * Conserva el mensaje que devuelve el API. El backend distingue entre
   * credenciales incorrectas y usuario inactivo; el formulario muestra ese
   * texto en lugar de reemplazarlo por uno genérico.
   */
  private loginErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      const message = body?.message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }

      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }
    }

    return 'El correo o la contraseña no son correctos.';
  }

  logout(): void {
    this.currentUserState.set(null);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  /** Nivel efectivo de un módulo para la sesión activa. */
  permission(module: ModuleKey): PermissionLevel {
    return this.currentUserState()?.permissions?.[module] ?? 'NONE';
  }

  /** true si la sesión activa alcanza el nivel mínimo pedido en el módulo. */
  can(module: ModuleKey, required: PermissionLevel = 'VIEW'): boolean {
    return permissionAtLeast(this.permission(module), required);
  }

  /** Actualiza la matriz de la sesión (por ejemplo, tras editarla uno mismo). */
  setPermissions(permissions: PermissionMap): void {
    const user = this.currentUserState();
    if (!user) {
      return;
    }

    this.setSession({ ...user, permissions });
  }

  /**
   * Refresca el perfil y los permisos de la sesión tras editar al propio
   * usuario. Si el rol cambió, el API ya restableció su matriz.
   */
  async applyUpdatedProfile(profile: UserProfile): Promise<void> {
    const permissions = await this.userService.getPermissions(profile.id);

    this.setSession({
      ...profile,
      permissions: permissions ?? this.currentUserState()?.permissions ?? null,
    });
  }

  private setSession(profile: UserProfile): void {
    this.currentUserState.set(profile);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
    }
  }

  /**
   * Restaura la sesión guardada. Las sesiones anteriores a la matriz de
   * permisos se descartan: sin ella el usuario no sabría qué puede abrir.
   */
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

      if (!profile || typeof profile.id !== 'string' || typeof profile.email !== 'string') {
        return null;
      }

      if (!profile.permissions || typeof profile.permissions !== 'object') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return profile;
    } catch {
      return null;
    }
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
      permissions: mapApiPermissions(account.permissions ?? []),
      permissionsOverridden: 0,
    };
  }
}
