import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthPageLayoutComponent } from '../../../../layout/auth-page-layout/auth-page-layout.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { SigninFormComponent } from '../../components/signin-form/signin-form.component';

@Component({
  selector: 'app-sign-in',
  imports: [AuthPageLayoutComponent, IconComponent, RouterLink, SigninFormComponent],
  templateUrl: './sign-in.component.html',
})
export class SignInComponent {}
