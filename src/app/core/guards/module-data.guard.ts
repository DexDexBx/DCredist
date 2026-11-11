import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { ApiHydrationService } from '../services/api-hydration.service';

/** Eventos y su informacion de participacion (listado, detalle, edicion). */
export const eventsDataGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([
    hydration.ensureReferenceData(),
    hydration.ensureEvents(),
    hydration.ensureParticipations(),
  ]);
  return true;
};

/** Solo el catalogo de eventos (calendario y alta de evento). */
export const eventsCoreGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([hydration.ensureReferenceData(), hydration.ensureEvents()]);
  return true;
};

/** Padron y catalogos para alta/edicion de estudiantes. */
export const studentsCoreGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([hydration.ensureReferenceData(), hydration.ensureStudents()]);
  return true;
};

/** Padron + historial de participaciones para creditos y fichas. */
export const studentsDataGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([
    hydration.ensureReferenceData(),
    hydration.ensureEvents(),
    hydration.ensureStudents(),
    hydration.ensureParticipations(),
  ]);
  return true;
};

/** Participaciones + padron + eventos para contexto, filtros e importacion. */
export const participationsDataGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([
    hydration.ensureReferenceData(),
    hydration.ensureEvents(),
    hydration.ensureStudents(),
    hydration.ensureParticipations(),
  ]);
  return true;
};

export const usersDataGuard: CanActivateFn = async () => {
  const hydration = inject(ApiHydrationService);
  await Promise.all([hydration.ensureReferenceData(), hydration.ensureUsers()]);
  return true;
};

export const catalogsDataGuard: CanActivateFn = async () => {
  await inject(ApiHydrationService).ensureReferenceData();
  return true;
};
