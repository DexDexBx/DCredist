import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUserDto, UpdateUserDto, UserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { UpdateUserPermissionsDto, UserPermissionsDto } from './dto/user-permissions.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista los usuarios del directorio con filtros opcionales.',
    description:
      'search coincide parcialmente con nombre y correo. El hash de la contraseña nunca se devuelve.',
  })
  @ApiOkResponse({ type: [UserDto] })
  findAll(@Query() query: QueryUsersDto): Promise<UserDto[]> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ficha de un usuario del directorio.' })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  findOne(@Param('id') id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Registra un usuario con su contraseña inicial.',
    description:
      'La contraseña se guarda como hash scrypt y nunca se devuelve. El correo es unico.',
  })
  @ApiCreatedResponse({ type: UserDto })
  @ApiBadRequestResponse({ description: 'Datos invalidos o contraseña demasiado corta.' })
  @ApiConflictResponse({ description: 'El correo ya existe.' })
  create(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita un usuario, cambia su estado o restablece su contraseña.',
    description: [
      'Solo se actualizan los campos enviados.',
      'Si se envia password, se reemplaza el hash: sirve para cuando la persona olvida su contraseña.',
      'Si cambia el rol, la matriz de permisos se restablece al preset del nuevo rol.',
    ].join(' '),
  })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  @ApiConflictResponse({ description: 'El correo ya existe.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.usersService.update(id, dto);
  }

  @Get(':id/permissions')
  @ApiOperation({
    summary: 'Matriz de permisos de un usuario.',
    description:
      'Devuelve una entrada por modulo. Si la cuenta aun no tiene filas, se responde con el preset de su rol.',
  })
  @ApiOkResponse({ type: UserPermissionsDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  findPermissions(@Param('id') id: string): Promise<UserPermissionsDto> {
    return this.usersService.findPermissions(id);
  }

  @Put(':id/permissions')
  @ApiOperation({
    summary: 'Reemplaza la matriz de permisos de un usuario.',
    description:
      'Envia el conjunto completo de modulos. Lo que no venga se completa con el preset del rol.',
  })
  @ApiOkResponse({ type: UserPermissionsDto })
  @ApiBadRequestResponse({ description: 'Modulo desconocido o nivel invalido.' })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto
  ): Promise<UserPermissionsDto> {
    return this.usersService.updatePermissions(id, dto);
  }
}
