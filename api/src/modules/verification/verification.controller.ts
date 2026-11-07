import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../common/actor/actor.types';
import { CurrentActor } from '../../common/actor/current-actor.decorator';
import { ConstancyVerificationResultDto } from '../constancies/dto/constancy.dto';
import { SuggestVerificationCodesDto } from './dto/suggest-verification-codes.dto';
import { VerificationResultDto } from './dto/verification-result.dto';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get(':code')
  @ApiOperation({
    summary: 'Consulta un codigo unico de participacion.',
    description:
      'Acepta el codigo generado por DCredits (DC-AAAA-XXXXXX, con o sin prefijo) y el codigo original de una participacion historica. Distingue participacion vigente, anulada y no encontrada.',
  })
  @ApiOkResponse({ type: VerificationResultDto })
  verify(
    @Param('code') code: string,
    @CurrentActor() actor: Actor
  ): Promise<VerificationResultDto> {
    return this.verificationService.verify(code, actor);
  }

  @Get('constancies/:code')
  @ApiOperation({
    summary: 'Verifica un codigo de constancia de creditos.',
    description:
      'Consulta el codigo persistido en la tabla constancies y devuelve el estado actual de la constancia.',
  })
  @ApiOkResponse({ type: ConstancyVerificationResultDto })
  verifyConstancy(
    @Param('code') code: string,
    @CurrentActor() actor: Actor
  ): Promise<ConstancyVerificationResultDto> {
    return this.verificationService.verifyConstancy(code, actor);
  }

  @Get()
  @ApiOperation({ summary: 'Sugiere codigos a partir de los ultimos caracteres escritos.' })
  @ApiOkResponse({ type: [String] })
  suggest(
    @Query() query: SuggestVerificationCodesDto,
    @CurrentActor() actor: Actor
  ): Promise<string[]> {
    return this.verificationService.suggest(query.q ?? '', actor, query.limit);
  }
}