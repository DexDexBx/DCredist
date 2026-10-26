import { ApiProperty } from '@nestjs/swagger';
import { ParticipationStatus, ParticipationType } from '../../../generated/prisma/client';

/**
 * Estudiante registrado en un evento, con los datos que necesita la
 * revision de participantes, el exporte institucional y la carga masiva:
 *   codigo universitario, grado, apellidos, nombres, escuela, sede,
 *   tipo de participacion, codigo DCredits, creditos y nota.
 *
 * El `verificationCode` viaja aqui porque es la unica fuente de verdad del
 * codigo de participacion y del certificado: la interfaz nunca lo genera.
 */
export class EventParticipantDto {
  @ApiProperty() participationId!: string;
  @ApiProperty() studentId!: string;

  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'QUINTO' }) academicDegree!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;
  @ApiProperty({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' }) professionalSchool!: string;
  @ApiProperty({ example: 'FILIAL LIMA' }) headquarters!: string;

  @ApiProperty({ enum: ParticipationType }) participationType!: ParticipationType;
  @ApiProperty({
    example: 'DC-2026-8F4K2P',
    description: 'Codigo unico y estable de DCredits. Es tambien el codigo del certificado.',
  })
  verificationCode!: string;
  @ApiProperty({ example: 1.5 }) credits!: number;
  @ApiProperty({ example: 16, nullable: true, description: 'null significa sin nota, no 0.' }) grade!: number | null;
  @ApiProperty({ enum: ParticipationStatus }) status!: ParticipationStatus;

  @ApiProperty() participationDate!: Date;
}

/** Evento con su conteo de participantes, para el dashboard. */
export class EventSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'EVT-2026-001' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 'Congreso' }) category!: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() modality!: string;
  @ApiProperty() location!: string;
  @ApiProperty({ nullable: true }) capacity!: number | null;
  @ApiProperty() organizer!: string;
  @ApiProperty({ example: 2 }) credits!: number;
  @ApiProperty() status!: string;

  @ApiProperty({
    example: 128,
    description: 'Participaciones vigentes (VALID). Es lo que ocupa cupo.',
  })
  registeredCount!: number;
}