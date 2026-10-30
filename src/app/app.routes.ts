import { Routes } from '@angular/router';

import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

/**
 * RUTAS DE DCREDITS.
 *
 * Cada pantalla se carga bajo demanda (`loadComponent`): el chunk inicial solo
 * trae el layout, los guards y los servicios. Así el calendario, el padrón y las
 * pantallas de impresión no engordan la primera descarga.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard.component').then(
            (module) => module.DashboardComponent
          ),
        title: 'Dashboard | DCredits',
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/pages/event-list/event-list.component').then(
            (module) => module.EventListComponent
          ),
        title: 'Eventos | DCredits',
      },
      {
        // events/new antes de events/:id para que "new" no se tome como id.
        path: 'events/new',
        loadComponent: () =>
          import('./features/events/pages/event-new/event-new.component').then(
            (module) => module.EventNewComponent
          ),
        title: 'Nuevo evento | DCredits',
        canActivate: [permissionGuard('events', 'MANAGE')],
      },
      {
        path: 'events/calendar',
        loadComponent: () =>
          import('./features/events/pages/event-calendar/event-calendar.component').then(
            (module) => module.EventCalendarComponent
          ),
        title: 'Calendario | DCredits',
      },
      {
        path: 'events/:id',
        loadComponent: () =>
          import('./features/events/pages/event-detail/event-detail.component').then(
            (module) => module.EventDetailComponent
          ),
        title: 'Detalle del evento | DCredits',
      },
      {
        path: 'students',
        loadComponent: () =>
          import('./features/students/pages/student-list/student-list.component').then(
            (module) => module.StudentListComponent
          ),
        title: 'Padrón de estudiantes | DCredits',
      },
      {
        path: 'students/new',
        loadComponent: () =>
          import('./features/students/pages/student-new/student-new.component').then(
            (module) => module.StudentNewComponent
          ),
        title: 'Nuevo estudiante | DCredits',
        canActivate: [permissionGuard('students', 'MANAGE')],
      },
      {
        path: 'students/:id',
        loadComponent: () =>
          import('./features/students/pages/student-detail/student-detail.component').then(
            (module) => module.StudentDetailComponent
          ),
        title: 'Ficha del estudiante | DCredits',
      },
      {
        path: 'students/:id/constancy',
        loadComponent: () =>
          import('./features/students/pages/student-constancy/student-constancy.component').then(
            (module) => module.StudentConstancyComponent
          ),
        title: 'Constancia de avance | DCredits',
      },
      {
        path: 'students/:id/certificate',
        loadComponent: () =>
          import('./features/students/pages/student-certificate/student-certificate.component').then(
            (module) => module.StudentCertificateComponent
          ),
        title: 'Constancia de créditos | DCredits',
      },
      {
        path: 'participations',
        loadComponent: () =>
          import('./features/participations/pages/participation-list/participation-list.component').then(
            (module) => module.ParticipationListComponent
          ),
        title: 'Participaciones | DCredits',
      },
      {
        path: 'certificates/codes',
        loadComponent: () =>
          import('./features/participations/pages/certificate-codes/certificate-codes.component').then(
            (module) => module.CertificateCodesComponent
          ),
        title: 'Códigos de certificado | DCredits',
        canActivate: [permissionGuard('certificates', 'MANAGE')],
      },
      {
        path: 'participations/register',
        loadComponent: () =>
          import('./features/participations/pages/participation-register/participation-register.component').then(
            (module) => module.ParticipationRegisterComponent
          ),
        title: 'Registrar participación | DCredits',
        canActivate: [permissionGuard('participations', 'MANAGE')],
      },
      {
        path: 'verify',
        loadComponent: () =>
          import('./features/verification/pages/verification/verification.component').then(
            (module) => module.VerificationComponent
          ),
        title: 'Verificar código | DCredits',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/pages/user-list/user-list.component').then(
            (module) => module.UserListComponent
          ),
        title: 'Usuarios y perfiles | DCredits',
        canActivate: [permissionGuard('users', 'VIEW')],
      },
      {
        // users/new antes de users/:id para que "new" no se tome como id.
        path: 'users/new',
        loadComponent: () =>
          import('./features/users/pages/user-new/user-new.component').then(
            (module) => module.UserNewComponent
          ),
        title: 'Nuevo usuario | DCredits',
        canActivate: [permissionGuard('users', 'MANAGE')],
      },
      {
        path: 'users/:id',
        loadComponent: () =>
          import('./features/users/pages/user-detail/user-detail.component').then(
            (module) => module.UserDetailComponent
          ),
        title: 'Ficha del usuario | DCredits',
        canActivate: [permissionGuard('users', 'VIEW')],
      },
      {
        path: 'catalogs',
        pathMatch: 'full',
        redirectTo: 'catalogs/organizers',
      },
      {
        path: 'catalogs/:kind',
        loadComponent: () =>
          import('./features/catalogs/pages/catalog-admin/catalog-admin.component').then(
            (module) => module.CatalogAdminComponent
          ),
        title: 'Catálogos | DCredits',
        canActivate: [permissionGuard('catalogs', 'VIEW')],
      },
    ],
  },
  {
    path: 'signin',
    loadComponent: () =>
      import('./features/auth/pages/sign-in/sign-in.component').then(
        (module) => module.SignInComponent
      ),
    title: 'Iniciar sesión | DCredits',
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/pages/sign-up/sign-up.component').then(
        (module) => module.SignUpComponent
      ),
    title: 'Crear cuenta | DCredits',
    canActivate: [guestGuard],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/errors/pages/not-found/not-found.component').then(
        (module) => module.NotFoundComponent
      ),
    title: 'Página no encontrada | DCredits',
  },
];
