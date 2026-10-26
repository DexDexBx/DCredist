import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

@Component({
  selector: 'app-signup-form',
  imports: [ReactiveFormsModule, RouterLink, DcInputComponent, IconComponent],
  templateUrl: './signup-form.component.html',
})
export class SignupFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    firstNames: ['', [Validators.required, Validators.minLength(2)]],
    lastNames: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  

  onSubmit(): void {
    this.form.markAllAsTouched();
  }

  hasError(control: 'firstNames' | 'lastNames' | 'email' | 'password', error: string): boolean {
    const field = this.form.controls[control];
    return field.touched && field.hasError(error);
  }
}
