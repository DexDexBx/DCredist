import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserService } from '../../../../core/services/user.service';
import {
  ALL_USER_ROLES,
  ROLE_LABELS,
  USER_STATUS_LABEL,
  UserStatus,
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

  readonly roleOptions: DcSelectOption[] = ALL_USER_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  readonly statusOptions: DcSelectOption[] = (['ACTIVE', 'INACTIVE'] as UserStatus[]).map(
    (status) => ({ value: status, label: USER_STATUS_LABEL[status] })
  );

  readonly user = computed(() => this.userService.findById(this.id()));

  readonly canManage = computed(() => this.auth.can('users', 'MANAGE'));

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['OPERATOR' as UserRole, [Validators.required]],
    status: ['ACTIVE' as UserStatus, [Validators.required]],
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
          status: user.status,
        });
      }
    });
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

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.saved.set(false);

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const validation = this.userService.validate(value, this.id());

    if (!validation.valid) {
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del usuario.');
      return;
    }

    const updated = await this.userService.update(this.id(), value);

    if (updated) {
      this.saved.set(true);
    } else {
      this.formError.set('No se pudo guardar los cambios. Intenta nuevamente.');
    }
  }

  async toggleStatus(): Promise<void> {
    const user = this.user();
    if (!user) {
      return;
    }

    const next = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await this.userService.setStatus(user.id, next);
    this.form.patchValue({ status: next });
  }

  isInvalid(control: 'fullName' | 'email' | 'role'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  goBack(): void {
    void this.router.navigate(['/users']);
  }
}
