import type { ConstancyRecord } from './constancy.model';

/** Escuela profesional que se ofrece en el portal publico del estudiante. */
export interface StudentPortalSchool {
  id: number;
  name: string;
}

/** Participacion visible en el historial publico del estudiante. */
export interface StudentPortalHistoryItem {
  id: number;
  eventId: number;
  eventCode: string;
  eventName: string;
  eventTypeName: string;
  eventDateType: 'LONG' | 'SHORT';
  eventStartDate: string;
  eventEndDate: string;
  modality: string;
  location: string;
  participationDate: string;
  credits: number;
  grade: string;
  status: string;
  origin: string;
  descriptionStatus: string;
  verificationCode: string;
}

/** Datos verificados del estudiante y su resumen de creditos. */
export interface StudentPortalProfile {
  id: number;
  universityCode: string;
  lastName: string;
  firstName: string;
  professionalSchoolId: number;
  professionalSchool: string;
  location: string;
  status: string;
  totalCredits: number;
  creditsTarget: number;
  progress: number;
  remainingCredits: number;
  completed: boolean;
  totalParticipations: number;
  validParticipations: number;
  cancelledParticipations: number;
  constancy: ConstancyRecord | null;
  history: StudentPortalHistoryItem[];
}

/** Resultado de la consulta publica. */
export type StudentPortalConsultResult =
  | { ok: true; student: StudentPortalProfile }
  | { ok: false; message: string };
