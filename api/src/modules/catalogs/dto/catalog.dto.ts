import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { CatalogStatus } from '../../../generated/prisma/client';

/** Campos editables de una entrada de catalogo. */
export class CreateCatalogEntryDto {
  @ApiProperty({ example: 'Ingenieria de Sistemas', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ enum: CatalogStatus, default: CatalogStatus.ACTIVE })
  @IsOptional()
  @IsEnum(CatalogStatus)
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
