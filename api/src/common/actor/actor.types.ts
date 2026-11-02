import type { UserRole } from '../../generated/prisma/client';

/**
 * Usuario que ejecuta la peticion.
 *
 * Se resuelve desde la cabecera `X-User-Id` que envia el frontend con la
 * sesion activa. `isGlobal` es true cuando su escuela es `general`: esas
 * cuentas pueden operar sobre todas las escuelas. El resto solo ve y modifica
 * los estudiantes, eventos y participaciones de su propia escuela.
 */
export interface Actor {
  id: string;
  role: UserRole;
  professionalSchoolId: number;
  professionalSchoolName: string;
  isGlobal: boolean;
}
