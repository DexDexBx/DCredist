import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { ROLE_LABELS } from '../../../../models/user.model';
import { IconComponent } from '../../ui/icon/icon.component';

/**
 * Menu de usuario. Muestra el perfil activo de la sesión de demostración y
 * permite cerrarla. El acceso real llegará con la API de DCredits.
 */
@Component({
  selector: 'dc-user-menu',
  imports: [RouterLink, IconComponent],
  templateUrl: './user-menu.component.html',
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly open = signal(false);

  readonly currentUser = this.auth.currentUser;
  readonly displayName = computed(() => this.currentUser()?.fullName ?? 'Sin sesión');
  readonly initials = computed(() => this.currentUser()?.initials ?? 'DC');
  readonly roleLabel = computed(() => {
    const user = this.currentUser();
    return user ? ROLE_LABELS[user.role] : 'Acceso de demostración';
  });

  toggle(): void {
    this.open.update((value) => !value);
  }

  close(): void {
    this.open.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.close();
    void this.router.navigateByUrl('/signin');
  }
}
