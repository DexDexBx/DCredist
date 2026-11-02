import { ApiProperty } from '@nestjs/swagger';
import { CatalogStatus } from '../../../generated/prisma/client';

/** Tipo de evento academico tal como lo devuelve `GET /event-types`. */
export class EventTypeDto {
  @ApiProperty({ example: 1 }) id!: number;
  @ApiProperty({ example: 'Congress' }) name!: string;
  @ApiProperty({ enum: CatalogStatus, example: CatalogStatus.ACTIVE })
  status!: CatalogStatus;
}
