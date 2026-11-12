import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import { Public } from '../../common/actor/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambia la contraseña de la cuenta autenticada.',
    description:
      'Exige la contraseña actual y la confirmación de la nueva. Al completarlo, la cuenta deja de estar pendiente de cambio y puede usar el sistema.',
  })
  @ApiOkResponse({ description: 'Contraseña actualizada.' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentActor() actor: Actor
  ): Promise<{ changed: boolean; mustChangePassword: false }> {
    return this.authService.changePassword(actor.id, dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia sesion con correo y contrasena.',
    description:
      'Valida las credenciales contra la tabla users. La contrasena se compara con su hash scrypt; nunca se devuelve.',
  })
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales invalidas o cuenta inactiva.' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }
}
