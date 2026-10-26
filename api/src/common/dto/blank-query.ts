import { Transform } from 'class-transformer';

/**
 * Convierte un filtro de query vacio ("") en "sin filtro" (undefined).
 *
 * `@IsOptional()` solo omite la validacion cuando el valor es `undefined` o
 * `null`: un `?status=` vacio debe tratarse como filtro ausente y no como un
 * valor invalido. El frontend construye sus queries con los valores de los
 * formularios, que estan vacios cuando el usuario limpia un filtro.
 *
 * Solo afecta a cadenas: numeros y booleanos se validan tal cual llegan.
 */
export function blankToUndefined(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    return value.trim() === '' ? undefined : value;
  });
}
