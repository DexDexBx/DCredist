import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../api/api.config';
import { readSessionUserId } from '../auth/session-storage';

/**
 * Aplica la configuracion de `API_CONFIG` a cada peticion:
 *  - anteponer `baseUrl` a las URLs relativas,
 *  - adjuntar la cabecera de autenticacion cuando este configurada.
 *
 * Ademas envia `X-User-Id` con el usuario de la sesion. El API lo usa para
 * resolver el alcance por escuela de estudiantes, eventos y participaciones.
 * El login queda fuera: es publico y todavia no existe sesion.
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);
  const isLogin = request.url.endsWith('/auth/login');
  const userId = isLogin ? null : readSessionUserId();

  let headers = request.headers;

  if (config.authHeader) {
    headers = headers.set('Authorization', config.authHeader);
  }

  if (userId) {
    headers = headers.set('X-User-Id', userId);
  }

  const url =
    config.baseUrl && !/^https?:\/\//i.test(request.url)
      ? `${config.baseUrl}${request.url}`
      : request.url;

  return next(request.clone({ url, headers }));
};
