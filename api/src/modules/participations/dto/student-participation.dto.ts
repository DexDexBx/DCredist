import { ApiProperty } from '@nestjs/swagger';
import { ParticipationStatus, ParticipationType } from '../../../generated/prisma/client';

/**
 * Participacion con su evento resuelto: es la vista que necesita la ficha del
 * estudiante (evento, fecha, tipo, creditos, codigo DCredits, nota y estado).
 *
 * El codigo unico de DCredits es el unico codigo de la participacion: tambien
 * es el codigo del certificado.
 */
export class StudentParticipationDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventId!: string;
  @ApiProperty() studentId!: string;

  @ApiProperty() eventCode!: string;
  @ApiProperty() eventName!: string;

  @ApiProperty({ enum: ParticipationType }) participationType!: ParticipationType;
  @ApiProperty() participationDate!: Date;
  @ApiProperty({ example: 1.5 }) credits!: number;

  @ApiProperty({ example: 'DC-2026-8F4K2P', description: 'Codigo unico y estable de DCredits.' })
  verificationCode!: string;

  @ApiProperty({ example: 16, nullable: true, description: 'null significa sin nota, no 0.' })
  grade!: number | null;

  @ApiProperty({ enum: ParticipationStatus }) status!: ParticipationStatus;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
