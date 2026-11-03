import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { CatalogStatus } from '../../../generated/prisma/client';

/** Campos editables de una entrada de catalogo. */
export class CreateCatalogEntryDto {
  @ApiProperty({ example: 'Ingenieria de Sistemas', maxLength: 150 })
  @IsString({ message: 'El nombre debe ser texto.' })
  @Matches(/^[^0-9]*$/, { message: 'El nombre no puede contener números.' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres.' })
  @MaxLength(150, { message: 'El nombre no puede superar los 150 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ enum: CatalogStatus, default: CatalogStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CatalogStatus, { message: 'El estado debe ser ACTIVE o INACTIVE.' })
  status?: CatalogStatus;
}

export class UpdateCatalogEntryDto extends PartialType(CreateCatalogEntryDto) {}

/** Filtros comunes de los tres catalogos. */
export class QueryCatalogDto {
  @ApiPropertyOptional({ description: 'Coincidencia parcial por nombre.' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ enum: CatalogStatus })
  @IsOptional()
  @IsEnum(CatalogStatus)
  status?: CatalogStatus;

  @ApiPropertyOptional({
    description:
      'Solo para usuarios globales: incluye la escuela `general` en el listado. Por defecto se oculta.',
  })
  @IsOptional()
  @IsString()
  includeGeneral?: string;
}

/** Entrada de catalogo con el conteo de registros que la usan. */
export class CatalogEntryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Ingenieria de Sistemas' })
  name!: string;

  @ApiProperty({ enum: CatalogStatus })
  status!: CatalogStatus;

  @ApiProperty({
    example: 12,
    description: 'Usuarios, estudiantes o eventos que referencian la entrada.',
  })
  usageCount!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
