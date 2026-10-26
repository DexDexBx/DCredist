import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ModuleKey, PermissionLevel } from '../../models/permission.model';
import { AuthService } from '../services/auth.service';

/**
 * Restringe una ruta al nivel minimo de un modulo. Sin sesión pide credenciales;
 * con sesión insuficiente devuelve a la persona al panel.
 */
export function permissionGuard(
  module: ModuleKey,
  required: PermissionLevel,
): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/signin']);
    }

    return auth.can(module, required) ? true : router.createUrlTree(['/']);
  };
}
