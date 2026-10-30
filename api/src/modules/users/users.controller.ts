import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
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
    ].join(' '),
  })
  @ApiOkResponse({ type: UserDto })
  @ApiNotFoundResponse({ description: 'El usuario no existe.' })
  @ApiConflictResponse({ description: 'El correo ya existe.' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.usersService.update(id, dto);
  }
}
