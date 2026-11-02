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

import { CatalogsService } from './catalogs.service';
import {
  CatalogEntryDto,
  CreateCatalogEntryDto,
  QueryCatalogDto,
  UpdateCatalogEntryDto,
} from './dto/catalog.dto';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las sedes.' })
  @ApiOkResponse({ type: [CatalogEntryDto] })
  findAll(@Query() query: QueryCatalogDto): Promise<CatalogEntryDto[]> {
    return this.catalogs.findLocations(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'La sede no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CatalogEntryDto> {
    return this.catalogs.findLocation(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una sede.' })
  @ApiCreatedResponse({ type: CatalogEntryDto })
  @ApiConflictResponse({ description: 'El nombre ya existe.' })
  create(@Body() dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    return this.catalogs.createLocation(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'La sede no existe.' })
  @ApiConflictResponse({ description: 'El nombre ya existe.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatalogEntryDto
  ): Promise<CatalogEntryDto> {
    return this.catalogs.updateLocation(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Sede eliminada.' })
  @ApiConflictResponse({ description: 'Tiene estudiantes vinculados.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.catalogs.removeLocation(id);
  }
}
