import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  MIN_PASSWORD_LENGTH,
  MODULES,
  PermissionMap,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_DESCRIPTIONS,
  UserCreateDraft,
  UserDraft,
  UserProfile,
  UserUpdateDraft,
  UserValidation,
} from '../../models';
import { initialsOf } from '../../shared/utils/text.utils';
import {
  mapApiPermissions,
  mapApiUser,
  toApiPermissionsPayload,
  toApiUserCreatePayload,
  toApiUserUpdatePayload,
} from '../api/api.mappers';
import { DcreditsApiClient } from '../api/dcredits-api.client';
import { DataModeService } from './data-mode.service';

/**
 * SERVICE - DIRECTORIO DE USUARIOS.
 *
 * Lee del API (hidratado al arrancar) y escribe contra el backend cuando está
 * disponible; sin API opera en memoria durante la sesión. Contrato:
 *   GET   /users
 *   GET   /users/:id
 *   POST  /users
 *   PATCH /users/:id
 *   GET   /users/:id/permissions
 *   PUT   /users/:id/permissions
 *   GET   /modules
 *
 * La contraseña se define en el alta y se puede restablecer desde la ficha del
 * usuario. El backend la guarda como hash scrypt y nunca la devuelve.
 *
 * La matriz de permisos vive en la base (`user_module_permissions`). Aquí solo
 * se pide al abrir la tuerca de accesos y se envía al guardar.
 *
 * Regla de dominio: el correo es UNIQUE. La validación se hace aquí y
 * reaparece como constraint UNIQUE en el backend.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly usersState = signal<UserProfile[]>([]);

  /** Solo se usa sin API: matriz por usuario en memoria durante la sesión. */
  private readonly localPermissions = signal<Record<string, PermissionMap>>({});

  readonly users = this.usersState.asReadonly();

  readonly totalCount = computed(() => this.usersState().length);

  readonly activeCount = computed(
    () => this.usersState().filter((user) => user.status === 'ACTIVE').length
  );

  private readonly byIdIndex = computed(() => {
    const index = new Map<string, UserProfile>();
    for (const user of this.usersState()) {
      index.set(user.id, user);
    }
    return index;
  });

  /** Reemplaza el directorio con el que devuelve el API (hidratación al arrancar). */
  replaceAll(users: UserProfile[]): void {
    this.usersState.set(users);
  }

  findById(id: string): UserProfile | undefined {
    return this.byIdIndex().get(id);
  }

  findByEmail(email: string): UserProfile | undefined {
    const normalized = email.trim().toLowerCase();
    return this.usersState().find((user) => user.email.toLowerCase() === normalized);
  }

  existsEmail(email: string, exceptId?: string): boolean {
    const existing = this.findByEmail(email);
    return Boolean(existing && existing.id !== exceptId);
  }

  /**
   * Valida el borrador. En el alta (`requirePassword`) la contraseña es
   * obligatoria; en la edición solo se valida si se escribió una nueva.
   */
  validate(
    draft: UserDraft & { password?: string },
    exceptId?: string,
    requirePassword = false
  ): UserValidation {
    const errors: UserValidation['errors'] = {};

    if (!draft.fullName.trim()) {
      errors.fullName = 'El nombre completo es obligatorio.';
    }

    const email = draft.email.trim();
    if (!email) {
      errors.email = 'El correo es obligatorio.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'El correo no tiene un formato válido.';
    } else if (this.existsEmail(email, exceptId)) {
      errors.email = 'Ya existe un usuario con este correo.';
    }

    const password = draft.password ?? '';
    if (requirePassword && !password) {
      errors.password = 'La contraseña es obligatoria.';
    } else if (password && password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  async create(draft: UserCreateDraft): Promise<UserProfile | null> {
    if (!this.validate(draft, undefined, true).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const created = await firstValueFrom(
          this.api.createUser(toApiUserCreatePayload(draft))
        );
        const user = mapApiUser(created);
        this.usersState.update((current) => [...current, user]);
        return user;
      } catch {
        return null;
      }
    }

    const user = this.normalizeDraft(draft, `user-${Date.now().toString(36)}`);
    this.usersState.update((current) => [...current, user]);
    return user;
  }

  async update(id: string, draft: UserUpdateDraft): Promise<UserProfile | null> {
    if (!this.findById(id) || !this.validate(draft, id).valid) {
      return null;
    }

    if (this.dataMode.isApi) {
      try {
        const updated = await firstValueFrom(
          this.api.updateUser(id, toApiUserUpdatePayload(draft))
        );
        const user = mapApiUser(updated);
        this.replaceById(id, user);
        return user;
      } catch {
        return null;
      }
    }

    const user = this.normalizeDraft(draft, id);
    this.replaceById(id, user);
    return user;
  }

  async setStatus(id: string, status: UserProfile['status']): Promise<void> {
    const current = this.findById(id);
    if (!current || current.status === status) {
      return;
    }

    if (this.dataMode.isApi) {
      try {
        const updated = await firstValueFrom(this.api.updateUser(id, { status }));
        this.replaceById(id, mapApiUser(updated));
        return;
      } catch {
        // Si el API falla, no se toca el estado local: evita mostrar un cambio
        // que en realidad no se guardó.
        return;
      }
    }

    this.replaceById(id, { ...current, status });
  }

  // --- Permisos -------------------------------------------------------------

  /** Nombres de los módulos registrados en la base (GET /modules). */
  async listModuleNames(): Promise<string[] | null> {
    if (!this.dataMode.isApi) {
      return MODULES.map((module) => module.key);
    }

    try {
      const modules = await firstValueFrom(this.api.listModules());
      return modules.map((module) => module.name);
    } catch {
      return null;
    }
  }

  /**
   * Matriz de permisos de un usuario. Se pide solo al abrir la tuerca de
   * accesos: el listado no la trae para no cargar nueve filas por usuario.
   */
  async getPermissions(id: string): Promise<PermissionMap | null> {
    const user = this.findById(id);

    if (!this.dataMode.isApi) {
      const stored = this.localPermissions()[id];
      return stored ?? (user ? { ...ROLE_DEFAULT_PERMISSIONS[user.role] } : null);
    }

    try {
      const response = await firstValueFrom(this.api.getUserPermissions(id));
      return mapApiPermissions(response.permissions);
    } catch {
      return null;
    }
  }

  /** Reemplaza la matriz completa del usuario. */
  async updatePermissions(id: string, permissions: PermissionMap): Promise<PermissionMap | null> {
    const user = this.findById(id);
    if (!user) {
      return null;
    }

    if (!this.dataMode.isApi) {
      this.localPermissions.update((current) => ({ ...current, [id]: permissions }));
      this.setPermissionsOverridden(id, user.role, permissions);
      return permissions;
    }

    try {
      const response = await firstValueFrom(
        this.api.updateUserPermissions(id, toApiPermissionsPayload(permissions))
      );
      const updated = mapApiPermissions(response.permissions);
      this.setPermissionsOverridden(id, user.role, updated);
      return updated;
    } catch {
      return null;
    }
  }

  /** Refresca el "X módulos ajustados" del listado sin volver a pedir el directorio. */
  private setPermissionsOverridden(
    id: string,
    role: UserProfile['role'],
    permissions: PermissionMap
  ): void {
    const count = MODULES.filter(
      (module) => permissions[module.key] !== ROLE_DEFAULT_PERMISSIONS[role][module.key]
    ).length;

    this.usersState.update((current) =>
      current.map((user) => (user.id === id ? { ...user, permissionsOverridden: count } : user))
    );
  }

  /**
   * Normaliza el borrador: el nombre queda como se escribió (con sus mayúsculas)
   * y la descripción se deriva del perfil elegido, igual que el directorio.
   */
  private normalizeDraft(draft: UserDraft, id: string): UserProfile {
    const fullName = draft.fullName.trim().replace(/\s+/g, ' ');

    return {
      id,
      fullName,
      email: draft.email.trim().toLowerCase(),
      role: draft.role,
      status: draft.status,
      initials: initialsOf(fullName),
      description: ROLE_DESCRIPTIONS[draft.role],
      permissions: null,
      permissionsOverridden: 0,
    };
  }

  private replaceById(id: string, user: UserProfile): void {
    this.usersState.update((current) => {
      const next = current.slice();
      const index = next.findIndex((item) => item.id === id);
      if (index >= 0) {
        next[index] = user;
      }
      return next;
    });
  }
}
