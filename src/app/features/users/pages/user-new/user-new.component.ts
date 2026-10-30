import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../../../core/services/user.service';
import {
  ALL_USER_ROLES,
  MIN_PASSWORD_LENGTH,
  ROLE_LABELS,
  UserCreateDraft,
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
 * Registra un perfil activo en el directorio. La contraseña definida aquí es la
 * que usará la persona para iniciar sesión.
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

  readonly minPasswordLength = MIN_PASSWORD_LENGTH;

  readonly roleOptions: DcSelectOption[] = ALL_USER_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
    // Arranca vacío para que el select muestre "Selecciona una opción". Al
    // elegir un perfil, el placeholder queda deshabilitado y ya no se puede
    // volver a seleccionar.
    role: this.fb.nonNullable.control<UserRole | ''>('', Validators.required),
  });

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    this.createdName.set(null);

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();

    // El select de perfil arranca en el placeholder: no se puede guardar sin
    // elegir uno.
    if (!value.role) {
      this.formError.set('Selecciona un perfil de acceso.');
      return;
    }

    // Un usuario nuevo siempre nace activo: se crea justamente para usarlo.
    const draft: UserCreateDraft = {
      fullName: value.fullName,
      email: value.email,
      password: value.password,
      role: value.role,
      status: 'ACTIVE',
    };
    const validation = this.userService.validate(draft, undefined, true);

    if (!validation.valid) {
      this.formError.set(Object.values(validation.errors)[0] ?? 'Revisa los datos del usuario.');
      return;
    }

    const user = await this.userService.create(draft);

    if (user) {
      this.createdName.set(user.fullName);
      this.form.reset({
        fullName: '',
        email: '',
        password: '',
        role: '',
      });
      this.form.markAsUntouched();
    } else {
      this.formError.set('No se pudo registrar el usuario. Intenta nuevamente.');
    }
  }

  onCancel(): void {
    void this.router.navigate(['/users']);
  }

  isInvalid(control: 'fullName' | 'email' | 'password' | 'role'): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }
}
