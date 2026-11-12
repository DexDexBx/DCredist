import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Bloquea el panel mientras la cuenta siga con la contraseña inicial.
 *
 * Se aplica al layout: cualquier ruta interna redirige al cambio de contraseña
 * hasta que `mustChangePassword` quede en false.
 */
export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.mustChangePassword()
    ? router.createUrlTree(['/change-password'])
    : true;
};

/**
 * Permite entrar al cambio de contraseña solo si hay sesión y el cambio está
 * pendiente. Si ya se cambió, vuelve al panel.
 */
export const passwordChangePageGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/signin']);
  }

  return auth.mustChangePassword() ? true : router.createUrlTree(['/']);
};
