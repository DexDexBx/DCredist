import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

@Component({
  selector: 'app-signin-form',
  imports: [ReactiveFormsModule, DcInputComponent, IconComponent],
  templateUrl: './signin-form.component.html',
})
export class SigninFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set('');

    if (this.form.invalid) {
      return;
    }

    const { email, password } = this.form.getRawValue();

    if (!this.auth.login(email, password)) {
      this.errorMessage.set('El correo o la contraseña no son correctos.');
      return;
    }

    this.redirectAfterLogin();
  }

  hasError(control: 'email' | 'password', error: string): boolean {
    const field = this.form.controls[control];
    return field.touched && field.hasError(error);
  }

  private redirectAfterLogin(): void {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    const target =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';

    void this.router.navigateByUrl(target);
  }
}
