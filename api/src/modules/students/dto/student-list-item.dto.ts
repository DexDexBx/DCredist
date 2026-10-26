import { ApiProperty } from '@nestjs/swagger';
import { StudentStatus } from '../../../generated/prisma/client';

/**
 * Fila del padron con el resumen de creditos ya resuelto.
 *
 * El listado lo trae junto porque el padron siempre se muestra con "creditos
 * acumulados". Calcularlo con SQL evita una peticion por estudiante.
 */
export class StudentListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'QUINTO' }) academicDegree!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;
  @ApiProperty({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' }) professionalSchool!: string;
  @ApiProperty({ example: 'FILIAL LIMA' }) headquarters!: string;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;

  @ApiProperty({ example: 4.5, description: 'Suma de creditos de participaciones VALID.' })
  totalCredits!: number;

  @ApiProperty({ example: 21, description: 'Meta institucional de creditos para egresar.' })
  creditsTarget!: number;

  @ApiProperty({
    example: 21.4,
    description: 'Avance hacia la meta, en porcentaje acotado a 100.',
  })
  progress!: number;

  @ApiProperty({ example: 16.5, description: 'Creditos que faltan para alcanzar la meta.' })
  remainingCredits!: number;

  @ApiProperty({ example: false, description: 'true cuando ya alcanzo la meta.' })
  completed!: boolean;

  @ApiProperty({ example: 3 }) totalParticipations!: number;
  @ApiProperty({ example: 3 }) validParticipations!: number;
  @ApiProperty({ example: 0 }) cancelledParticipations!: number;
  @ApiProperty({ example: 0 }) pendingParticipations!: number;
  @ApiProperty({ example: 2, description: 'Eventos distintos en los que participa.' })
  eventsParticipated!: number;
  @ApiProperty({ example: 1, description: 'Participaciones vigentes sin nota registrada.' })
  pendingGrades!: number;
}

/** Valores distintos existentes, para alimentar los filtros del padron. */
export class StudentFacetsDto {
  @ApiProperty({ type: [String] }) professionalSchools!: string[];
  @ApiProperty({ type: [String] }) headquarters!: string[];
}