import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import {
  ALL_USER_ROLES,
  MIN_PASSWORD_LENGTH,
  ROLE_LABELS,
  USER_STATUS_LABEL,
  UserRole,
} from '../../../../models';
import {
  BadgeColor,
  BadgeComponent,
} from '../../../../shared/components/ui/badge/badge.component';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import {
  DcSelectComponent,
  DcSelectOption,
} from '../../../../shared/components/form/dc-select/dc-select.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

/**
 * FICHA DEL USUARIO: perfil visible y edición de sus datos.
 *
 * El formulario solo se muestra con permiso de gestión (users:MANAGE); los
 * usuarios que solo pueden ver el módulo ven la información sin editar.
 */
@Component({
  selector: 'app-user-detail',
  imports: [
    BadgeComponent,
    DcInputComponent,
    DcSelectComponent,
    EmptyStateComponent,
    IconComponent,
    NgClass,
    PageHeaderComponent,
    PanelComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './user-detail.component.html',
})
export class UserDetailComponent {
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly auth = inject(AuthService);

  /** Identificador tomado de la ruta /users/:id. */
  readonly id = input.required<string>();

  readonly saved = signal(false);
  readonly formError = signal<string | null>(null);

  readonly roleLabels = ROLE_LABELS;
  readonly statusLabel = USER_STATUS_LABEL;

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly roleOptions: DcSelectOption[] = ALL_USER_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  readonly user = computed(() => this.userService.findById(this.id()));

  readonly canManage = computed(() => this.auth.can('users', 'MANAGE'));

  /** true si la ficha abierta es la cuenta con la sesión activa. */
  readonly isSelf = computed(() => {
    const user = this.user();
    return !!user && this.auth.currentUser()?.id === user.id;
  });

  /** Cuántas cuentas tienen el perfil de Administrador en todo el directorio. */
  readonly adminCount = computed(
    () => this.userService.users().filter((account) => account.role === 'ADMIN').length
  );

  /**
   * Si esta ficha es la del administrador que tiene la sesión y es el único
   * Administrador, no puede cambiarse el perfil: dejaría al sistema sin nadie
   * que pueda revertirlo.
   */
  readonly roleLocked = computed(
    () => this.isSelf() && this.user()?.role === 'ADMIN' && this.adminCount() <= 1
  );

  readonly roleHint = computed(() =>
    this.roleLocked()
      ? 'Eres el único administrador: asigna el perfil de Administrador a otra cuenta antes de cambiarte el tuyo.'
      : 'Define qué módulos puede ver y gestionar.'
  );

  /**
   * El estado no vive en el formulario: se gestiona con el interruptor de la
   * cabecera. Aquí solo se editan los datos del perfil.
   */
  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(MIN_PASSWORD_LENGTH)]],
    role: ['OPERATOR' as UserRole, [Validators.required]],
  });

  private formInitialized = false;

  constructor() {
    // El input de ruta llega durante la detección de cambios, no en el
    // constructor: el primer usuario resuelto inicializa el formulario una sola vez.
    effect(() => {
      const user = this.user();
      if (user && !this.formInitialized) {
        this.formInitialized = true;
        this.form.patchValue({
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        });
      }
    });

    // Un administrador único no puede cambiarse el perfil: el selector queda
    // deshabilitado y su valor actual se conserva al guardar.
    effect(() => {
      const control = this.form.controls.role;
      if (this.roleLocked()) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    });
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

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.saved.set(false);

    const user = this.user();

    if (!user || this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    // El estado lo administra el interruptor de la cabecera: al guardar se
    // conserva el que ya tiene el usuario.
    const draft = {
      fullName: value.fullName,
      email: value.email,
      // El perfil bloqueado no se puede alterar ni enviando otro valor.
      role: this.roleLocked() ? user.role : value.role,
      status: user.status,
      password: value.password || undefined,
    };
    const validation = this.userService.validate(draft, this.id());

    if (!validation.valid) {
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del usuario.');
      return;
    }

    const updated = await this.userService.update(this.id(), draft);

    if (updated) {
      this.saved.set(true);
      this.form.controls.password.reset('');

      // Si editaste tu propia cuenta, la sesión debe reflejar el nuevo perfil y
      // la matriz que el API restableció si cambió el rol.
      if (this.auth.currentUser()?.id === updated.id) {
        await this.auth.applyUpdatedProfile(updated);
      }
    } else {
      this.formError.set('No se pudo guardar los cambios. Intenta nuevamente.');
    }
  }

  async toggleStatus(): Promise<void> {
    const user = this.user();
    // Nadie puede desactivar su propia cuenta: perdería el acceso.
    if (!user || this.isSelf()) {
      return;
    }

    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await this.userService.setStatus(user.id, next);
  }

  isInvalid(control: 'fullName' | 'email' | 'password' | 'role'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  goBack(): void {
    void this.router.navigate(['/users']);
  }
}
