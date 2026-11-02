import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { Actor } from './actor.types';

/**
 * Filtro de escuela para las consultas.
 *
 * Un actor global no agrega filtro; uno de escuela solo puede ver su propia
 * escuela. Se usa en estudiantes, eventos, participaciones y reportes.
 */
export function schoolWhere(actor: Actor): { professionalSchoolId?: number } {
  return actor.isGlobal ? {} : { professionalSchoolId: actor.professionalSchoolId };
}

/** Para lecturas: un registro de otra escuela se trata como inexistente. */
export function assertCanReadSchool(actor: Actor, schoolId: number): void {
  if (!actor.isGlobal && schoolId !== actor.professionalSchoolId) {
    throw new NotFoundException('El registro no pertenece a tu escuela.');
  }
}

/** Para escrituras: el mensaje explica por que no se permite la operacion. */
export function assertCanWriteSchool(actor: Actor, schoolId: number): void {
  if (!actor.isGlobal && schoolId !== actor.professionalSchoolId) {
    throw new ForbiddenException('Solo puedes operar sobre tu propia escuela.');
  }
}
