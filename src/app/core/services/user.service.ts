import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  MIN_PASSWORD_LENGTH,
  ROLE_DESCRIPTIONS,
  UserCreateDraft,
  UserDraft,
  UserProfile,
  UserUpdateDraft,
  UserValidation,
} from '../../models';
import { initialsOf } from '../../shared/utils/text.utils';
import {
  mapApiUser,
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
 *
 * La contraseña se define en el alta y se puede restablecer desde la ficha del
 * usuario. El backend la guarda como hash scrypt y nunca la devuelve.
 *
 * Regla de dominio: el correo es UNIQUE. La validación se hace aquí y
 * reaparece como constraint UNIQUE en el backend.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(DcreditsApiClient);
  private readonly dataMode = inject(DataModeService);
  private readonly usersState = signal<UserProfile[]>([]);

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
