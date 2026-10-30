import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { apiInterceptor } from './core/interceptors/api.interceptor';
import { ApiHydrationService } from './core/services/api-hydration.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withComponentInputBinding expone los parametros de ruta como inputs del componente.
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient queda disponible para los servicios que consumen el API.
    provideHttpClient(withInterceptors([apiInterceptor])),
    // Carga los datos del API antes de mostrar la aplicacion. Si el API no
    // responde, la aplicacion arranca con el estado local vacio.
    provideAppInitializer(() => inject(ApiHydrationService).hydrate()),
  ],
};
