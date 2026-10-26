import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
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

  @ApiPropertyOptional({ example: 'QUINTO', description: 'Grado academico. Opcional.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  academicDegree?: string;

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

  @ApiProperty({ example: 'CIENCIAS FARMACEUTICAS Y BIOQUIMICA' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  professionalSchool!: string;

  @ApiProperty({ example: 'FILIAL LIMA' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  headquarters!: string;

  @ApiPropertyOptional({ enum: StudentStatus, default: StudentStatus.ACTIVE })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}

/** Fila de carga del padron. Todo excepto el codigo es opcional: el padron se enriquece. */
export class StudentImportRowDto {
  @ApiProperty({ example: '2213271' })
  @IsString()
  @MaxLength(32)
  universityCode!: string;

  @ApiPropertyOptional({ example: 'QUINTO' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  academicDegree?: string;

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
  @MaxLength(120)
  headquarters?: string;
}

/**
 * CARGA INCREMENTAL DEL PADRON.
 *
 * Nunca es destructiva: crea los codigos nuevos y completa los datos faltantes
 * de los existentes. No borra estudiantes niparticipaciones.
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
    example: 'MISSING_NAMES',
    description: 'MISSING_CODE | DUPLICATE_IN_FILE | MISSING_NAMES | DB_ERROR',
  })
  code!: string;

  @ApiProperty({ example: 'La fila no trae apellidos ni nombres.' })
  message!: string;
}

export class StudentImportResultDto {
  @ApiProperty({ example: 240, description: 'Filas unicas leidas del archivo.' })
  total!: number;

  @ApiProperty({ example: 35 }) created!: number;
  @ApiProperty({ example: 205, description: 'Codigos que ya existian y se enriquecieron.' })
  enriched!: number;

  @ApiProperty({ type: [StudentImportIssueDto] })
  issues!: StudentImportIssueDto[];
}