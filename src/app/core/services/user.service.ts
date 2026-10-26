import { Injectable, computed, signal } from '@angular/core';
import { UserDraft, UserValidation, UserProfile } from '../../models';
import { ROLE_DESCRIPTIONS, MOCK_USER_DIRECTORY, initialsOf } from './mock-data/users.mock';

/**
 * SERVICE - DIRECTORIO DE USUARIOS.
 *
 * Administra los perfiles del sistema (nombre, correo, perfil y estado). Mientras
 * no exista el backend, opera en memoria sobre una copia del directorio mock:
 * los cambios viven durante la sesión y desaparecen al recargar. Cuando el API
 * exponga `/users` (GET, POST, PATCH) este servicio pasará a consumirlo con el
 * mismo contrato dual que StudentService y EventService.
 *
 * Regla de dominio: el correo es UNIQUE. La validación se hace aquí y deberá
 * reaparecer como constraint UNIQUE en el backend.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly usersState = signal<UserProfile[]>(
    MOCK_USER_DIRECTORY.map((user) => ({ ...user }))
  );

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

  validate(draft: UserDraft, exceptId?: string): UserValidation {
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

    return { valid: Object.keys(errors).length === 0, errors };
  }

  async create(draft: UserDraft): Promise<UserProfile | null> {
    if (!this.validate(draft).valid) {
      return null;
    }

    const user = this.normalizeDraft(draft, `user-${Date.now().toString(36)}`);
    this.usersState.update((current) => [...current, user]);
    return user;
  }

  async update(id: string, draft: UserDraft): Promise<UserProfile | null> {
    if (!this.findById(id) || !this.validate(draft, id).valid) {
      return null;
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

    this.replaceById(id, { ...current, status });
  }

  /**
   * Normaliza el borrador: el nombre queda como se escribió (con sus mayúsculas)
   * y la descripción se deriva del perfil elegido, igual que el directorio mock.
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
