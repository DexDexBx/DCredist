import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un endpoint que no requiere la cabecera de usuario (por ejemplo, el login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
