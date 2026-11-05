import { ApiProperty } from '@nestjs/swagger';
import {
  ParticipationOrigin,
  ParticipationStatus,
} from '../../../generated/prisma/client';

/**
 * Participacion con su evento resuelto: es la vista que necesita la ficha del
 * estudiante (evento, fecha, tipo, creditos, codigo DCredits, nota y estado).
 *
 * El codigo unico de DCredits es el unico codigo de la participacion: tambien
 * es el codigo del certificado.
 */
export class StudentParticipationDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 1 }) eventId!: number;
  @ApiProperty({ example: 1 }) studentId!: number;

  @ApiProperty() eventCode!: string;
  @ApiProperty() eventName!: string;

  @ApiProperty() participationDate!: Date;
  @ApiProperty({ example: 1.5 }) credits!: number;

  @ApiProperty({ example: 'DC-2026-8F4K2P', description: 'Codigo unico y estable de DCredits.' })
  verificationCode!: string;

  @ApiProperty({ example: '16', description: 'Nota entre 0 y 20, o "sin nota".' })
  grade!: string;

  @ApiProperty({ enum: ParticipationStatus }) status!: ParticipationStatus;

  @ApiProperty({
    enum: ParticipationOrigin,
    description: 'CURRENT: registro nuevo con codigo generado. LEGACY: data historica.',
  })
  origin!: ParticipationOrigin;

  @ApiProperty({ example: 'Ana Torres', description: 'Usuario que creo la participacion.' })
  userCreate!: string;

  @ApiProperty({ example: 'Ana Torres', description: 'Usuario que la modifico por ultima vez.' })
  userUpdate!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
