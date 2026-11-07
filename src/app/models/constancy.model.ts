/** Estado persistido de una constancia de creditos. */
export type ConstancyStatus = 'ACTIVE' | 'INACTIVE';

/** Constancia emitida y guardada en la base de datos. */
export interface ConstancyRecord {
  code: string;
  status: ConstancyStatus;
  issuedAt: string;
  creditsAtIssue: number;
  currentCredits: number;
}
