import { ApiProperty } from '@nestjs/swagger';
import {
  EventDateType,
  EventModality,
  EventOrigin,
  EventStatus,
  EventType,
} from '../../../generated/prisma/client';

/**
 * Evento academico tal como lo devuelve el API.
 *
 * La escuela y el organizador viajan con su id (para editar) y con su nombre
 * (para listados, calendario, exportaciones y constancias), de modo que ninguna
 * pantalla tenga que resolver la relacion por su cuenta.
 */
export class EventDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'EVT-2026-001' }) code!: string;
  @ApiProperty({ example: 'Congreso Internacional de Educacion Superior' }) name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: 1 }) eventTypeId!: number;
  @ApiProperty({ example: 'Congress', description: 'Nombre del tipo (en ingles).' })
  eventTypeName!: string;
  @ApiProperty({ enum: EventType, description: 'Duracion: SINGLE_DAY o MULTI_DAY.' })
  durationType!: EventType;
  @ApiProperty({ example: '2026-10-05', description: 'Fecha calendario (YYYY-MM-DD).' })
  startDate!: Date;
  @ApiProperty({ example: '2026-10-07', description: 'Fecha calendario (YYYY-MM-DD).' })
  endDate!: Date;

  @ApiProperty({ enum: EventDateType, description: 'LONG: fecha completa. SHORT: solo mes y anio.' })
  dateType!: EventDateType;
  @ApiProperty({ enum: EventModality }) modality!: EventModality;

  @ApiProperty({
    example: 'Auditorio Central, Sede Central',
    description: 'Lugar fisico del evento. No es la sede del estudiante.',
  })
  location!: string;

  @ApiProperty({ example: 400, description: '0 significa sin limite de participantes.' })
  capacity!: number;

  @ApiProperty({ example: 1 }) organizerId!: number;
  @ApiProperty({ example: 'VICERRECTORIA ACADEMICA' }) organizer!: string;

  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty({ example: 'INGENIERIA DE SISTEMAS' }) professionalSchool!: string;

  @ApiProperty({ example: 2 }) credits!: number;
  @ApiProperty({ enum: EventStatus }) status!: EventStatus;
  @ApiProperty({ enum: EventOrigin, example: 'CURRENT' }) origin!: EventOrigin;
  @ApiProperty({ example: 'Ana Torres' }) userCreate!: string;
  @ApiProperty({ example: 'Ana Torres' }) userUpdate!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
