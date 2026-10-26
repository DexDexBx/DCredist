import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import {
  ALL_USER_ROLES,
  ROLE_LABELS,
  USER_STATUS_LABEL,
  UserStatus,
  UserRole,
} from '../../../../models';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import {
  DcSelectComponent,
  DcSelectOption,
} from '../../../../shared/components/form/dc-select/dc-select.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';

/**
 * ALTA DE USUARIOS.
 *
 * Registra un perfil en el directorio. La contraseña no se define aquí: mientras
 * no exista la API, el acceso se hace desde la sesión de demostración
 * ("entrar como este usuario" en el listado).
 */
@Component({
  selector: 'app-user-new',
  imports: [
    DcInputComponent,
    DcSelectComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './user-new.component.html',
})
export class UserNewComponent {
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly createdName = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly roleOptions: DcSelectOption[] = ALL_USER_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  readonly statusOptions: DcSelectOption[] = (['ACTIVE', 'INACTIVE'] as UserStatus[]).map(
    (status) => ({ value: status, label: USER_STATUS_LABEL[status] })
  );

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['OPERATOR' as UserRole, [Validators.required]],
    status: ['ACTIVE' as UserStatus, [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.createdName.set(null);

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const validation = this.userService.validate(value);

    if (!validation.valid) {
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del usuario.');
      return;
    }

    const user = await this.userService.create(value);

    if (user) {
      this.createdName.set(user.fullName);
      this.form.reset({
        fullName: '',
        email: '',
        role: 'OPERATOR',
        status: 'ACTIVE',
      });
      this.form.markAsUntouched();
    } else {
      this.formError.set('No se pudo registrar el usuario. Intenta nuevamente.');
    }
  }

  onCancel(): void {
    void this.router.navigate(['/users']);
  }

  isInvalid(control: 'fullName' | 'email' | 'role'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }
}
