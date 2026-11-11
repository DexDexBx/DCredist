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
    // La carga global corre en segundo plano: la aplicacion se muestra de
    // inmediato y las pantallas indican el progreso con sus loaders.
    provideAppInitializer(() => {
      void inject(ApiHydrationService).hydrate();
    }),
  ],
};
