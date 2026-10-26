import { ApiProperty } from '@nestjs/swagger';
import { StudentStatus } from '../../../generated/prisma/client';

/**
 * Ficha del estudiante con sus participaciones y creditos ya resueltos.
 *
 * `totalCredits` NO es una columna de la tabla students: se calcula en cada
 * consulta sumando los creditos de las participaciones vigentes (VALID).
 */
export class StudentDetail {
  @ApiProperty() id!: string;
  @ApiProperty() universityCode!: string;
  @ApiProperty() academicDegree!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() professionalSchool!: string;
  @ApiProperty() headquarters!: string;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;

  @ApiProperty({ description: 'Creditos acumulados de participaciones VALID.', example: 4.5 })
  totalCredits!: number;

  @ApiProperty({ example: 3 }) totalParticipations!: number;
  @ApiProperty({ example: 3 }) validParticipations!: number;
  @ApiProperty({ example: 0 }) cancelledParticipations!: number;
  @ApiProperty({ example: 0 }) pendingParticipations!: number;

  @ApiProperty({ type: () => [String] })
  participationIds!: string[];

  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
