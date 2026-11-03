import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { StudentStatus } from '../../../generated/prisma/client';

export class CreateStudentDto {
  @ApiProperty({ example: '2213271', description: 'Codigo universitario, unico.' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  universityCode!: string;

  @ApiProperty({ example: 'AGUILAR PEREZ' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: 'MARISOL SONIA' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 1, description: 'Escuela profesional del estudiante.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  professionalSchoolId!: number;

  @ApiProperty({ example: 1, description: 'Sede o filial del estudiante.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId!: number;

  @ApiPropertyOptional({ enum: StudentStatus, default: StudentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

/**
 * Fila de carga del padron.
 *
 * El archivo sigue trayendo nombres de escuela y sede (no ids): quien carga el
 * padron no conoce los identificadores internos. El backend los resuelve contra
 * el catalogo y rechaza la carga completa si alguno no existe.
 */
export class StudentImportRowDto {
  @ApiProperty({ example: '2213271' })
  @IsString()
  @MaxLength(32)
  universityCode!: string;

  @ApiPropertyOptional({ example: 'AGUILAR PEREZ' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional({ example: 'MARISOL SONIA' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  professionalSchool?: string;

  @ApiPropertyOptional({ example: 'FILIAL LIMA' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;
}

/**
 * CARGA INCREMENTAL DEL PADRON.
 *
 * Nunca es destructiva: crea los codigos nuevos e informa los que ya existian.
 * No borra estudiantes ni participaciones.
 *
 * Es atomica: si una fila tiene un error de validacion, no se escribe ninguna.
 */
export class ImportStudentsDto {
  @ApiProperty({ type: [StudentImportRowDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'El archivo no contiene filas para importar.' })
  @ArrayMaxSize(5000, { message: 'El archivo supera el maximo de 5000 filas por carga.' })
  @ValidateNested({ each: true })
  @Type(() => StudentImportRowDto)
  rows!: StudentImportRowDto[];
}

export class StudentImportIssueDto {
  @ApiProperty({ example: 4, description: 'Fila del archivo, empezando en 1.' })
  row!: number;

  @ApiProperty({ example: '2213999' })
  universityCode!: string;

  @ApiProperty({
    example: 'UNKNOWN_PROFESSIONAL_SCHOOL',
    description:
      'MISSING_CODE | INVALID_CODE | DUPLICATE_IN_FILE | MISSING_NAMES | MISSING_PROFESSIONAL_SCHOOL | MISSING_LOCATION | UNKNOWN_PROFESSIONAL_SCHOOL | UNKNOWN_LOCATION | INACTIVE_PROFESSIONAL_SCHOOL | INACTIVE_LOCATION | FOREIGN_PROFESSIONAL_SCHOOL | SCHOOL_MISMATCH | LOCATION_MISMATCH',
  })
  code!: string;

  @ApiProperty({ example: 'La escuela profesional "SISTEMAS" no existe en el catalogo.' })
  message!: string;
}

export class StudentImportResultDto {
  @ApiProperty({ example: 240, description: 'Filas unicas leidas del archivo.' })
  total!: number;

  @ApiProperty({ example: 35 }) created!: number;
  @ApiProperty({ example: 205, description: 'Codigos que ya existian y se conservaron sin cambios.' })
  enriched!: number;

  @ApiProperty({ type: [StudentImportIssueDto] })
  issues!: StudentImportIssueDto[];
}
