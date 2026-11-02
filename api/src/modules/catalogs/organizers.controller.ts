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

@ApiTags('organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly catalogs: CatalogsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los organizadores.' })
  @ApiOkResponse({ type: [CatalogEntryDto] })
  findAll(@Query() query: QueryCatalogDto): Promise<CatalogEntryDto[]> {
    return this.catalogs.findOrganizers(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'El organizador no existe.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<CatalogEntryDto> {
    return this.catalogs.findOrganizer(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un organizador.' })
  @ApiCreatedResponse({ type: CatalogEntryDto })
  @ApiConflictResponse({ description: 'El nombre ya existe.' })
  create(@Body() dto: CreateCatalogEntryDto): Promise<CatalogEntryDto> {
    return this.catalogs.createOrganizer(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: CatalogEntryDto })
  @ApiNotFoundResponse({ description: 'El organizador no existe.' })
  @ApiConflictResponse({ description: 'El nombre ya existe.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatalogEntryDto
  ): Promise<CatalogEntryDto> {
    return this.catalogs.updateOrganizer(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Organizador eliminado.' })
  @ApiConflictResponse({ description: 'Tiene eventos vinculados.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.catalogs.removeOrganizer(id);
  }
}
