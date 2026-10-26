import type { AcademicEvent } from './academic-event.model';
import type { StudentCreditSummary } from './credit.model';
import type { Participation } from './participation.model';
import type { Student } from './student.model';

/** Resultado de VerificationService.verify(code). */
export interface VerificationResult {
  participation: Participation;
  event: AcademicEvent | undefined;
  student: Student | undefined;
}

/**
 * Resultado de VerificationService.verifyConstancy(code).
 *
 * La constancia es un documento a NIVEL ESTUDIANTE (a diferencia del
 * certificado, que es por participacion). Para saber si sigue vigente no basta
 * con que el codigo exista: el estudiante debe seguir alcanzando los creditos
 * requeridos.
 */
export interface ConstancyVerificationResult {
  student: Student;
  summary: StudentCreditSummary;
  /** ISO de la fecha en que el estudiante alcanzo los creditos requeridos. */
  issuedOn: string | null;
  /** ¿El estudiante sigue cumpliendo el minimo para que la constancia valga? */
  meetsRequirement: boolean;
}
