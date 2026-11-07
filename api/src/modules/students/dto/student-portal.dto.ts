import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsString, Matches, Min } from 'class-validator';
import { ConstancyDto } from '../../constancies/dto/constancy.dto';
import {
  EventDateType,
  EventModality,
  ParticipationOrigin,
  ParticipationStatus,
  StudentStatus,
} from '../../../generated/prisma/client';

/** Escuela profesional visible en el formulario publico del estudiante. */
export class StudentPortalSchoolDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'INGENIERIA DE SISTEMAS' })
  name!: string;
}

/** Datos que envia el estudiante para validar su identidad. */
export class StudentPortalConsultDto {
  @ApiProperty({ example: '2213271', description: 'Codigo universitario de 7 digitos.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^\d{7}$/, { message: 'El codigo universitario debe tener 7 digitos.' })
  universityCode!: string;

  @ApiProperty({ example: 1, description: 'Escuela profesional seleccionada.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId!: number;
}

/** Una participacion del estudiante con los datos del evento. */
export class StudentPortalHistoryItemDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 1 }) eventId!: number;
  @ApiProperty({ example: 'EVT-2026-001' }) eventCode!: string;
  @ApiProperty({ example: 'Congreso Internacional 2026' }) eventName!: string;
  @ApiProperty({ example: 'Congress' }) eventTypeName!: string;
  @ApiProperty({ enum: EventDateType }) eventDateType!: EventDateType;
  @ApiProperty() eventStartDate!: Date;
  @ApiProperty() eventEndDate!: Date;
  @ApiProperty({ enum: EventModality }) modality!: EventModality;
  @ApiProperty({ example: 'Auditorio Central' }) location!: string;

  @ApiProperty() participationDate!: Date;
  @ApiProperty({ example: 2 }) credits!: number;
  @ApiProperty({ example: '18' }) grade!: string;
  @ApiProperty({ enum: ParticipationStatus }) status!: ParticipationStatus;
  @ApiProperty({ enum: ParticipationOrigin }) origin!: ParticipationOrigin;
  @ApiProperty({ example: 'valid' }) descriptionStatus!: string;
  @ApiProperty({ example: 'DC-2026-8F4K2P' }) verificationCode!: string;
}

/** Resultado de una consulta valida: identidad, resumen de creditos e historial. */
export class StudentPortalResultDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;

  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty({ example: 'INGENIERIA DE SISTEMAS' }) professionalSchool!: string;
  @ApiProperty({ example: 1 }) locationId!: number;
  @ApiProperty({ example: 'FILIAL LIMA' }) location!: string;

  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;

  @ApiProperty({ example: 4.5 }) totalCredits!: number;
  @ApiProperty({ example: 21 }) creditsTarget!: number;
  @ApiProperty({ example: 21.4 }) progress!: number;
  @ApiProperty({ example: 16.5 }) remainingCredits!: number;
  @ApiProperty({ example: false }) completed!: boolean;
  @ApiProperty({ example: 3 }) totalParticipations!: number;
  @ApiProperty({ example: 3 }) validParticipations!: number;
  @ApiProperty({ example: 0 }) cancelledParticipations!: number;

  @ApiProperty({ type: ConstancyDto, nullable: true })
  constancy!: ConstancyDto | null;

  @ApiProperty({ type: [StudentPortalHistoryItemDto] })
  history!: StudentPortalHistoryItemDto[];
}
