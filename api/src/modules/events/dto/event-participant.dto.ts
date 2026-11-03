import { ApiProperty } from '@nestjs/swagger';
import { ParticipationStatus } from '../../../generated/prisma/client';

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
  @ApiProperty({ example: 1 }) participationId!: number;
  @ApiProperty({ example: 1 }) studentId!: number;

  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;
  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' }) professionalSchool!: string;
  @ApiProperty({ example: 1 }) locationId!: number;
  @ApiProperty({ example: 'FILIAL LIMA' }) location!: string;

  @ApiProperty({
    example: 'DC-2026-8F4K2P',
    description: 'Codigo unico y estable de DCredits. Es tambien el codigo del certificado.',
  })
  verificationCode!: string;
  @ApiProperty({ example: 1.5 }) credits!: number;
  @ApiProperty({ example: '16', description: 'Nota entre 0 y 20, o "sin nota".' })
  grade!: string;
  @ApiProperty({ enum: ParticipationStatus }) status!: ParticipationStatus;

  @ApiProperty() participationDate!: Date;
}

/** Evento con su conteo de participantes, para el dashboard. */
export class EventSummaryDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'EVT-2026-001' }) code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: 1 }) eventTypeId!: number;
  @ApiProperty({ example: 'Congress' }) eventTypeName!: string;
  @ApiProperty() startDate!: Date;
  @ApiProperty() endDate!: Date;
  @ApiProperty() modality!: string;
  @ApiProperty() location!: string;
  @ApiProperty({ example: 400, description: '0 significa sin limite.' }) capacity!: number;
  @ApiProperty({ example: 1 }) organizerId!: number;
  @ApiProperty() organizer!: string;
  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty() professionalSchool!: string;
  @ApiProperty({ example: 2 }) credits!: number;
  @ApiProperty() status!: string;

  @ApiProperty({
    example: 128,
    description: 'Participaciones vigentes (VALID). Es lo que ocupa cupo.',
  })
  registeredCount!: number;
}