import { PartialType } from '@nestjs/swagger';
import { EventFieldsDto } from './create-event.dto';

/**
 * Edicion de un evento.
 *
 * Se reutilizan las mismas reglas del alta, pero `name`, `startDate` y `endDate`
 * son opcionales: al editar solo se envia lo que cambia.
 */
export class UpdateEventDto extends PartialType(EventFieldsDto) {}