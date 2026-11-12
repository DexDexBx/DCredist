import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Evita volver al formulario de acceso cuando ya hay una sesión activa. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  // Una cuenta con contraseña temporal no puede volver al acceso ni al panel.
  return router.createUrlTree([auth.mustChangePassword() ? '/change-password' : '/']);
};
