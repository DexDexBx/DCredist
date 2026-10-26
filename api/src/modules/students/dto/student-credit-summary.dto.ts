import { ApiProperty } from '@nestjs/swagger';

/** Resumen de creditos derivado de PostgreSQL, nunca almacenado en Student. */
export class StudentCreditSummaryDto {
  @ApiProperty() studentId!: string;
  @ApiProperty({ example: 4.5, description: 'Suma de participaciones VALID.' })
  totalCredits!: number;
  @ApiProperty({ example: 21, description: 'Meta institucional de creditos.' })
  creditsTarget!: number;
  @ApiProperty({ example: 21.4, description: 'Avance en porcentaje, acotado a 100.' })
  progress!: number;
  @ApiProperty({ example: 16.5, description: 'Creditos faltantes para la meta.' })
  remainingCredits!: number;
  @ApiProperty({ example: false }) completed!: boolean;
  @ApiProperty({ example: 3 }) totalParticipations!: number;
  @ApiProperty({ example: 3 }) validParticipations!: number;
  @ApiProperty({ example: 0 }) cancelledParticipations!: number;
  @ApiProperty({ example: 0 }) pendingParticipations!: number;
}
