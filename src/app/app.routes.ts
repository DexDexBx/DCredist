import { Routes } from '@angular/router';

import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { DashboardComponent } from './features/dashboard/pages/dashboard/dashboard.component';
import { NotFoundComponent } from './features/errors/pages/not-found/not-found.component';
import { EventCalendarComponent } from './features/events/pages/event-calendar/event-calendar.component';
import { EventDetailComponent } from './features/events/pages/event-detail/event-detail.component';
import { EventListComponent } from './features/events/pages/event-list/event-list.component';
import { EventNewComponent } from './features/events/pages/event-new/event-new.component';
import { ParticipationListComponent } from './features/participations/pages/participation-list/participation-list.component';
import { ParticipationRegisterComponent } from './features/participations/pages/participation-register/participation-register.component';
import { CertificateCodesComponent } from './features/participations/pages/certificate-codes/certificate-codes.component';
import { StudentCertificateComponent } from './features/students/pages/student-certificate/student-certificate.component';
import { StudentConstancyComponent } from './features/students/pages/student-constancy/student-constancy.component';
import { StudentDetailComponent } from './features/students/pages/student-detail/student-detail.component';
import { StudentListComponent } from './features/students/pages/student-list/student-list.component';
import { StudentNewComponent } from './features/students/pages/student-new/student-new.component';
import { UserListComponent } from './features/users/pages/user-list/user-list.component';
import { UserNewComponent } from './features/users/pages/user-new/user-new.component';
import { UserDetailComponent } from './features/users/pages/user-detail/user-detail.component';
import { CatalogAdminComponent } from './features/catalogs/pages/catalog-admin/catalog-admin.component';
import { VerificationComponent } from './features/verification/pages/verification/verification.component';
import { SignInComponent } from './features/auth/pages/sign-in/sign-in.component';
import { SignUpComponent } from './features/auth/pages/sign-up/sign-up.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: DashboardComponent,
        title: 'Dashboard | DCredits',
      },
      {
        path: 'events',
        component: EventListComponent,
        title: 'Eventos | DCredits',
      },
      {
        // events/new antes de events/:id para que "new" no se tome como id.
        path: 'events/new',
        component: EventNewComponent,
        title: 'Nuevo evento | DCredits',
        canActivate: [permissionGuard('events', 'MANAGE')],
      },
      {
        path: 'events/calendar',
        component: EventCalendarComponent,
        title: 'Calendario | DCredits',
      },
      {
        path: 'events/:id',
        component: EventDetailComponent,
        title: 'Detalle del evento | DCredits',
      },
      {
        path: 'students',
        component: StudentListComponent,
        title: 'Padrón de estudiantes | DCredits',
      },
      {
        path: 'students/new',
        component: StudentNewComponent,
        title: 'Nuevo estudiante | DCredits',
        canActivate: [permissionGuard('students', 'MANAGE')],
      },
      {
        path: 'students/:id',
        component: StudentDetailComponent,
        title: 'Ficha del estudiante | DCredits',
      },
      {
        path: 'students/:id/constancy',
        component: StudentConstancyComponent,
        title: 'Constancia de avance | DCredits',
      },
      {
        path: 'students/:id/certificate',
        component: StudentCertificateComponent,
        title: 'Constancia de créditos | DCredits',
      },
      {
        path: 'participations',
        component: ParticipationListComponent,
        title: 'Participaciones | DCredits',
      },
      {
        path: 'certificates/codes',
        component: CertificateCodesComponent,
        title: 'Códigos de certificado | DCredits',
        canActivate: [permissionGuard('certificates', 'MANAGE')],
      },
      {
        path: 'participations/register',
        component: ParticipationRegisterComponent,
        title: 'Registrar participación | DCredits',
        canActivate: [permissionGuard('participations', 'MANAGE')],
      },
      {
        path: 'verify',
        component: VerificationComponent,
        title: 'Verificar código | DCredits',
      },
      {
        path: 'users',
        component: UserListComponent,
        title: 'Usuarios y perfiles | DCredits',
        canActivate: [permissionGuard('users', 'VIEW')],
      },
      {
        // users/new antes de users/:id para que "new" no se tome como id.
        path: 'users/new',
        component: UserNewComponent,
        title: 'Nuevo usuario | DCredits',
        canActivate: [permissionGuard('users', 'MANAGE')],
      },
      {
        path: 'users/:id',
        component: UserDetailComponent,
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
        component: CatalogAdminComponent,
        title: 'Catálogos | DCredits',
        canActivate: [permissionGuard('catalogs', 'VIEW')],
      },
    ],
  },
  {
    path: 'signin',
    component: SignInComponent,
    title: 'Iniciar sesión | DCredits',
    canActivate: [guestGuard],
  },
  {
    path: 'signup',
    component: SignUpComponent,
    title: 'Crear cuenta | DCredits',
    canActivate: [guestGuard],
  },
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Página no encontrada | DCredits',
  },
];
