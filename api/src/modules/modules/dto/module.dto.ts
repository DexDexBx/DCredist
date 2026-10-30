import { ApiProperty } from '@nestjs/swagger';

/** Modulo del sistema tal como vive en la tabla `modules`. */
export class ModuleDto {
  @ApiProperty({ example: '3f0f9c1a-8b0e-4b7a-9a51-6a2f0d1c9e11' })
  id!: string;

  @ApiProperty({
    example: 'events',
    description: 'Identificador estable del modulo. Coincide con el frontend.',
  })
  name!: string;
}
