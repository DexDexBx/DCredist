import { ApiProperty } from '@nestjs/swagger';
import { StudentStatus } from '../../../generated/prisma/client';

/**
 * Estudiante disponible para registrar en un evento.
 *
 * Se usa SOLO en el modulo de participaciones: a diferencia del padron, aqui
 * se listan estudiantes de cualquier escuela, porque un evento puede recibir
 * asistentes externos. Se devuelve un subconjunto ligero de datos.
 */
export class EligibleStudentDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 'AGUILAR PEREZ' }) lastName!: string;
  @ApiProperty({ example: 'MARISOL SONIA' }) firstName!: string;
  @ApiProperty({ example: 1 }) professionalSchoolId!: number;
  @ApiProperty({ example: 'DERECHO' }) professionalSchool!: string;
  @ApiProperty({ example: 1 }) locationId!: number;
  @ApiProperty({ example: 'FILIAL LIMA' }) location!: string;
  @ApiProperty({ enum: StudentStatus }) status!: StudentStatus;
}
