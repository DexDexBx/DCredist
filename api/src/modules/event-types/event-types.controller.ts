import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { EventTypeDto } from './dto/event-type.dto';
import { EventTypesService } from './event-types.service';

@ApiTags('event-types')
@Controller('event-types')
export class EventTypesController {
  constructor(private readonly eventTypes: EventTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los tipos de evento.',
    description:
      'Catalogo de solo lectura. El nombre se guarda en ingles; cada cliente lo traduce para mostrar.',
  })
  @ApiOkResponse({ type: EventTypeDto, isArray: true })
  findAll(): Promise<EventTypeDto[]> {
    return this.eventTypes.findAll();
  }
}
