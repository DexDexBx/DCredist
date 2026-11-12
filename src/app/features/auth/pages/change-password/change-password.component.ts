import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MIN_PASSWORD_LENGTH } from '../../../../models';
import { AuthService } from '../../../../core/services/auth.service';
import { AuthPageLayoutComponent } from '../../../../layout/auth-page-layout/auth-page-layout.component';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

/**
 * CAMBIO OBLIGATORIO DE CONTRASEÑA.
 *
 * Se muestra cuando una cuenta fue creada o su contraseña fue restablecida por
 * un administrador (`mustChangePassword = true`). Hasta completar este paso,
 * los guards no permiten entrar al panel ni el API acepta otras peticiones.
 */
@Component({
  selector: 'app-change-password',
  imports: [
    AuthPageLayoutComponent,
    DcInputComponent,
    IconComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './change-password.component.html',
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly minLength = MIN_PASSWORD_LENGTH;
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => {
        const newPassword = group.get('newPassword')?.value ?? '';
        const confirmPassword = group.get('confirmPassword')?.value ?? '';

        if (!confirmPassword) {
          return null;
        }

        return newPassword === confirmPassword ? null : { mismatch: true };
      },
    }
  );

  hasError(
    control: 'currentPassword' | 'newPassword' | 'confirmPassword',
    error: string
  ): boolean {
    const field = this.form.controls[control];
    return field.touched && field.hasError(error);
  }

  readonly passwordsMismatch = () =>
    this.form.controls.confirmPassword.touched && this.form.hasError('mismatch');

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();

    this.isSubmitting.set(true);
    const result = await this.auth.changePassword(
      currentPassword,
      newPassword,
      confirmPassword
    );
    this.isSubmitting.set(false);

    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'No se pudo cambiar la contraseña.');
      return;
    }

    void this.router.navigateByUrl('/', { replaceUrl: true });
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/signin', { replaceUrl: true });
  }
}
