import { EventStatus, ParticipationStatus, StudentStatus } from '../../models';
import { BadgeColor } from '../components/ui/badge/badge.component';

export const EVENT_STATUS_COLOR: Record<EventStatus, BadgeColor> = {
  Programado: 'primary',
  'En curso': 'success',
  Finalizado: 'light',
  Cancelado: 'error',
};

/** Colores usados por el calendario para cada estado de evento. */
export const EVENT_STATUS_HEX: Record<EventStatus, string> = {
  Programado: '#910048',
  'En curso': '#0E7C66',
  Finalizado: '#667085',
  Cancelado: '#B42318',
};

export const STUDENT_STATUS_COLOR: Record<StudentStatus, BadgeColor> = {
  ACTIVE: 'success',
  INACTIVE: 'light',
};

/**
 * Una participacion anulada se muestra en gris: sigue existiendo, pero ya no
 * otorga creditos.
 */
export const PARTICIPATION_STATUS_COLOR: Record<ParticipationStatus, BadgeColor> = {
  VALID: 'success',
  CANCELLED: 'light',
  PENDING: 'warning',
};
