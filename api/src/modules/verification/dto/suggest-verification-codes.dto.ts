import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { blankToUndefined } from '../../../common/dto/blank-query';

export const MIN_SUGGESTION_LENGTH = 3;
export const MAX_SUGGESTION_LIMIT = 20;

/**
 * Sugerencia de codigos a partir de lo que el usuario escribe.
 *
 * `q` es opcional a proposito: el campo de busqueda pide sugerencias en cada
 * tecla, y con menos de 3 caracteres la respuesta correcta es una lista vacia,
 * no un 400 por cada pulsacion. `limit` si se valida.
 */
export class SuggestVerificationCodesDto {
  @ApiPropertyOptional({
    example: '8F4',
    description: 'Fragmento del codigo. Con menos de 3 caracteres no hay sugerencias.',
  })
  @IsOptional()
  @IsString()
  @blankToUndefined()
  q?: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: MAX_SUGGESTION_LIMIT, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SUGGESTION_LIMIT)
  limit = 5;
}