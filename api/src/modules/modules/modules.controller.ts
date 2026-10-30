import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModuleDto } from './dto/module.dto';
import { ModulesService } from './modules.service';

@ApiTags('modules')
@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los modulos del sistema.',
    description:
      'Alimenta el catalogo de accesos. El nombre de cada modulo es el identificador que usa el frontend.',
  })
  @ApiOkResponse({ type: [ModuleDto] })
  findAll(): Promise<ModuleDto[]> {
    return this.modulesService.findAll();
  }
}
