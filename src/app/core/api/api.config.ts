import { InjectionToken } from '@angular/core';

/**
 * CONFIGURACION DE TRANSPORTE HTTP.
 *
 * `baseUrl` vacio deja las URLs relativas (`/api/...`): en desarrollo las
 * resuelve el proxy de `proxy.conf.json` hacia el backend NestJS y en produccion
 * el reverse proxy. `authHeader` vacio = sin cabecera extra: la V1 del API no
 * exige token.
 */
export interface ApiConfig {
  /** Prefijo de todas las peticiones, por ejemplo `/api`. */
  readonly baseUrl: string;
  /** Cabecera que se adjunta a cada peticion. Vacio = sin cabecera extra. */
  readonly authHeader: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('DCREDITS_API_CONFIG', {
  providedIn: 'root',
  factory: (): ApiConfig => ({
    baseUrl: '',
    authHeader: '',
  }),
});
