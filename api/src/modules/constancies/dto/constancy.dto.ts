import { ApiProperty } from '@nestjs/swagger';
import { ConstancyStatus, StudentStatus } from '../../../generated/prisma/client';

/** Registro persistido de una constancia de creditos. */
export class ConstancyDto {
  @ApiProperty({ example: 'CONST-2213271-ABC123' }) code!: string;
  @ApiProperty({ enum: ConstancyStatus }) status!: ConstancyStatus;
  @ApiProperty() issuedAt!: Date;
  @ApiProperty({ example: 21 }) creditsAtIssue!: number;
  @ApiProperty({ example: 21 }) currentCredits!: number;
}

/** Estudiante dentro del resultado de verificacion de constancia. */
export class ConstancyStudentDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;
  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty({ example: 'INGENIERIA DE SISTEMAS' }) professionalSchool!: string;
  @ApiProperty({ example: 1 }) locationId!: number;
  @ApiProperty({ example: 'FILIAL LIMA' }) location!: string;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;
}

/** Resumen de creditos actuales del estudiante verificado. */
export class ConstancySummaryDto {
  @ApiProperty({ example: 1 }) studentId!: number;
  @ApiProperty({ example: 21 }) totalCredits!: number;
  @ApiProperty({ example: 21 }) creditsTarget!: number;
  @ApiProperty({ example: 100 }) progress!: number;
  @ApiProperty({ example: 0 }) remainingCredits!: number;
  @ApiProperty({ example: true }) completed!: boolean;
  @ApiProperty({ example: 3 }) totalParticipations!: number;
  @ApiProperty({ example: 3 }) validParticipations!: number;
  @ApiProperty({ example: 0 }) cancelledParticipations!: number;
  @ApiProperty({ example: 0 }) pendingParticipations!: number;
  @ApiProperty({ example: 3 }) eventsParticipated!: number;
  @ApiProperty({ example: 0 }) pendingGrades!: number;
  @ApiProperty({ example: 3 }) certificateCount!: number;
}

/** Resultado de verificar un codigo de constancia. */
export class ConstancyVerificationResultDto {
  @ApiProperty({ enum: ['VALID', 'NOT_ISSUED', 'NOT_FOUND', 'INVALID_FORMAT'] })
  outcome!: 'VALID' | 'NOT_ISSUED' | 'NOT_FOUND' | 'INVALID_FORMAT';

  @ApiProperty({ example: 'Constancia verificada correctamente.' })
  message!: string;

  @ApiProperty({ type: ConstancyDto, nullable: true })
  constancy!: ConstancyDto | null;

  @ApiProperty({ type: ConstancyStudentDto, nullable: true })
  student!: ConstancyStudentDto | null;

  @ApiProperty({ type: ConstancySummaryDto, nullable: true })
  summary!: ConstancySummaryDto | null;

  @ApiProperty({ nullable: true, description: 'Fecha de emision original.' })
  issuedOn!: Date | null;

  @ApiProperty({ example: true })
  meetsRequirement!: boolean;
}
