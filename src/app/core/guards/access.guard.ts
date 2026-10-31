import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Exige que la cuenta tenga al menos un modulo habilitado.
 *
 * Se aplica a los hijos del layout: si la matriz de permisos esta en `NONE`
 * para todos los modulos, la persona va a la pantalla de acceso pendiente en
 * lugar de quedar en un panel sin opciones.
 */
export const accessGuard: CanActivateChildFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.hasAnyAccess() ? true : router.createUrlTree(['/no-access']);
};
