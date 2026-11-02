import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import { CatalogsService } from './catalogs.service';
import {
  CatalogEntryDto,
  CreateCatalogEntryDto,
  QueryCatalogDto,
  UpdateCatalogEntryDto,
} from './dto/catalog.dto';

@ApiTags('professional-schools')
@Controller('professional-schools')
export class ProfessionalSchoolsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista las escuelas profesionales.',
    description:
      'La escuela `general` se oculta por defecto. Solo un usuario global puede pedirla con includeGeneral=true para el formulario de usuarios.',
  })
  @ApiOkResponse({ type: [CatalogEntryDto] })
  findAll(
    @Query() query: QueryCatalogDto,
    @CurrentActor() actor: Actor
  ): Promise<CatalogEntryDto[]> {
    return this.catalogs.findProfessionalSchools(query, actor);
  }

  @Get(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'La escuela no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CatalogEntryDto> {
    return this.catalogs.findProfessionalSchool(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una escuela profesional.' })
  @ApiCreatedResponse({ type: CatalogEntryDto })
  @ApiConflictResponse({ description: 'El nombre ya existe o esta reservado.' })
  create(@Body() dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    return this.catalogs.createProfessionalSchool(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'La escuela no existe.' })
  @ApiConflictResponse({ description: 'El nombre ya existe o esta reservado.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatalogEntryDto
  ): Promise<CatalogEntryDto> {
    return this.catalogs.updateProfessionalSchool(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Escuela eliminada.' })
  @ApiConflictResponse({ description: 'Tiene registros vinculados o es la escuela general.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.catalogs.removeProfessionalSchool(id);
  }
}
