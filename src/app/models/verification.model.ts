import type { AcademicEvent } from './academic-event.model';
import type { ConstancyRecord } from './constancy.model';
import type { StudentCreditSummary } from './credit.model';
import type { Participation } from './participation.model';
import type { Student } from './student.model';

/** Resultado de VerificationService.verify(code). */
export interface VerificationResult {
  participation: Participation;
  event: AcademicEvent | undefined;
  student: Student | undefined;
}

/** Coincidencia individual de un codigo de participacion. */
export interface VerificationMatch extends VerificationResult {
  /** Creditos del estudiante en el momento de la verificacion. */
  credits: StudentCreditSummary | null;
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
  /** Registro persistido con el codigo inmutable de la constancia. */
  constancy: ConstancyRecord | null;
}
