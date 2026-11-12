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
import { mapApiPermissions, mapApiUser } from '../api/api.mappers';
import { ApiLoginResponse } from '../api/api.types';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { SESSION_STORAGE_KEY } from '../auth/session-storage';
import { UserService } from './user.service';

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
 * La caché se revalida al arrancar la aplicación y cuando se edita el propio
 * usuario, de modo que un cambio de rol o de permisos hecho desde otra sesión
 * se refleje al recargar sin obligar a cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(DcreditsApiClient);
  private readonly userService = inject(UserService);

  private readonly currentUserState = signal<UserProfile | null>(this.restoreSession());

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);
  readonly isAdmin = computed(() => this.currentUserState()?.role === 'ADMIN');

  /** true mientras la cuenta siga con la contraseña inicial. */
  readonly mustChangePassword = computed(
    () => this.currentUserState()?.mustChangePassword === true
  );

  /** true si la sesión tiene al menos un módulo con acceso (VIEW o MANAGE). */
  readonly hasAnyAccess = computed(() => {
    const permissions = this.currentUserState()?.permissions;
    if (!permissions) {
      return false;
    }

    return Object.values(permissions).some((level) => level !== 'NONE');
  });

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

  /**
   * Cambia la contraseña de la sesión activa.
   *
   * El API valida la contraseña actual y la confirmación. Al terminar, la
   * sesión local deja de estar pendiente de cambio.
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<LoginResult> {
    try {
      await firstValueFrom(
        this.api.changePassword({ currentPassword, newPassword, confirmPassword })
      );

      const user = this.currentUserState();
      if (user) {
        this.setSession({ ...user, mustChangePassword: false });
      }

      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.changePasswordErrorMessage(error) };
    }
  }

  private changePasswordErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      const message = body?.message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }

      if (Array.isArray(message) && typeof message[0] === 'string') {
        return message[0];
      }

      if (error.status === 0) {
        return 'No se pudo conectar con el API. Verifica que esté en ejecución.';
      }
    }

    return 'No se pudo cambiar la contraseña. Inténtalo nuevamente.';
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

  /**
   * Revalida la sesión guardada contra el API al arrancar la aplicación.
   *
   * El perfil y la matriz pueden haber cambiado desde el último inicio de
   * sesión (por ejemplo, porque otro administrador cambió el rol). Si la cuenta
   * ya no existe o está inactiva se cierra la sesión; si el API no responde se
   * conserva la caché para no expulsar a nadie por un fallo de red.
   *
   * El directorio de usuarios se carga por módulo, así que al arrancar puede
   * estar vacío. Por eso la ficha se pide directamente al API: depender de la
   * lista hidratada cerraba sesiones válidas al recargar o abrir otra pestaña.
   */
  async revalidateSession(): Promise<void> {
    const current = this.currentUserState();
    if (!current) {
      return;
    }

    let profile: UserProfile | null | undefined = this.userService.findById(current.id);

    if (!profile) {
      const fetched = await this.fetchSessionProfile(current.id);
      if (fetched === 'error') {
        // Sin respuesta del API se conserva la sesión en caché.
        return;
      }
      profile = fetched;
    }

    if (!profile || profile.status !== 'ACTIVE') {
      this.logout();
      return;
    }

    const permissions = await this.userService.getPermissions(current.id);
    if (!permissions) {
      return;
    }

    this.setSession({ ...profile, permissions });
  }

  /**
   * Ficha del usuario de la sesión pedida al API.
   *
   * Devuelve `null` cuando el API confirma que la cuenta ya no existe y
   * `'error'` cuando no fue posible consultarla (red, servidor caído, etc.).
   */
  private async fetchSessionProfile(id: number): Promise<UserProfile | null | 'error'> {
    try {
      const account = await firstValueFrom(this.api.getUser(id));
      return mapApiUser(account);
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 404 || error.status === 401)
      ) {
        return null;
      }
      return 'error';
    }
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

      if (!profile || (typeof profile.id !== 'number' || !Number.isInteger(profile.id) || profile.id <= 0) || typeof profile.email !== 'string') {
        return null;
      }

      if (!profile.permissions || typeof profile.permissions !== 'object') {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return { ...profile, mustChangePassword: profile.mustChangePassword === true };
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
      professionalSchoolId: account.professionalSchoolId,
      professionalSchoolName: account.professionalSchoolName,
      initials: initialsOf(account.fullName),
      description: ROLE_DESCRIPTIONS[account.role],
      permissions: mapApiPermissions(account.permissions ?? []),
      permissionsOverridden: 0,
      mustChangePassword: account.mustChangePassword === true,
    };
  }
}
