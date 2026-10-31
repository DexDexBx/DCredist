import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { AuthPageLayoutComponent } from '../../../../layout/auth-page-layout/auth-page-layout.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';

/**
 * ACCESO PENDIENTE.
 *
 * Se muestra cuando la cuenta esta activa pero su matriz de permisos no le da
 * acceso a ningun modulo. El administrador debe asignarle al menos uno desde
 * Usuarios y perfiles; al volver a iniciar sesion, la sesion recibe la matriz
 * actualizada.
 */
@Component({
  selector: 'app-no-access',
  imports: [AuthPageLayoutComponent, IconComponent],
  templateUrl: './no-access.component.html',
})
export class NoAccessComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/signin']);
  }
}
