import { ApiProperty } from '@nestjs/swagger';
import {
  ParticipationStatus,
  ParticipationType,
  EventStatus,
  EventModality,
  StudentStatus,
} from '../../../generated/prisma/client';

/**
 * Resultado de consultar un codigo de participacion.
 *
 * `outcome` distingue tres situaciones que la institucion necesita separar:
 *  - VALID: el codigo existe y la participacion otorga creditos,
 *  - CANCELLED: el codigo existio, pero la participacion fue anulada,
 *  - NOT_FOUND: el codigo no corresponde a ninguna participacion.
 */
export class VerificationResultDto {
  @ApiProperty({ enum: ['VALID', 'CANCELLED', 'NOT_FOUND', 'INVALID_FORMAT'] })
  outcome!: 'VALID' | 'CANCELLED' | 'NOT_FOUND' | 'INVALID_FORMAT';

  @ApiProperty({
    example: 'Participacion verificada correctamente.',
    description: 'Mensaje listo para mostrar al estudiante.',
  })
  message!: string;

  @ApiProperty({ nullable: true, description: 'Participacion encontrada. null si no existe.' })
  participation!: {
    id: string;
    participationType: ParticipationType;
    participationDate: Date;
    credits: number;
    verificationCode: string;
    grade: number | null;
    status: ParticipationStatus;
  } | null;

  @ApiProperty({ nullable: true })
  event!: {
    id: string;
    code: string;
    name: string;
    category: string;
    startDate: Date;
    endDate: Date;
    modality: EventModality;
    location: string;
    organizer: string;
    credits: number;
    status: EventStatus;
  } | null;

  @ApiProperty({ nullable: true })
  student!: {
    id: string;
    universityCode: string;
    academicDegree: string;
    lastName: string;
    firstName: string;
    professionalSchool: string;
    headquarters: string;
    status: StudentStatus;
  } | null;

  @ApiProperty({
    nullable: true,
    description: 'Creditos acumulados del estudiante, no solo los de este evento.',
  })
  credits!: {
    totalCredits: number;
    totalParticipations: number;
    validParticipations: number;
    cancelledParticipations: number;
    pendingParticipations: number;
  } | null;
}