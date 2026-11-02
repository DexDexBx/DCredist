import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { Actor } from './actor.types';

/** Inyecta el actor resuelto por ActorGuard en un parametro del controlador. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { actor: Actor }>();

    return request.actor;
  }
);
