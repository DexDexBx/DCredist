import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_CONFIG } from '../api/api.config';

/**
 * Aplica la configuracion de `API_CONFIG` a cada peticion:
 *  - anteponer `baseUrl` a las URLs relativas,
 *  - adjuntar la cabecera de autenticacion cuando este configurada.
 *
 * Con los valores por defecto (`baseUrl` y `authHeader` vacios) el interceptor
 * es transparente: no modifica ni bloquea ninguna peticion.
 */
export const apiInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(API_CONFIG);

  if (!config.baseUrl && !config.authHeader) {
    return next(request);
  }

  let headers = request.headers;

  if (config.authHeader) {
    headers = headers.set('Authorization', config.authHeader);
  }

  const url = config.baseUrl && !/^https?:\/\//i.test(request.url)
    ? `${config.baseUrl}${request.url}`
    : request.url;

  return next(request.clone({ url, headers }));
};
