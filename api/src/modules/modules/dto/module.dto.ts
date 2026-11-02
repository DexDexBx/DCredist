import { ApiProperty } from '@nestjs/swagger';

/** Modulo del sistema tal como vive en la tabla `modules`. */
export class ModuleDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({
    example: 'events',
    description: 'Identificador estable del modulo. Coincide con el frontend.',
  })
  name!: string;
}
