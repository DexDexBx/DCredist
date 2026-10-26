import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
      'Acepta DC-AAAA-XXXXXX y tambien el cuerpo sin el prefijo "DC-". Distingue participacion vigente, anulada y no encontrada.',
  })
  @ApiOkResponse({ type: VerificationResultDto })
  verify(@Param('code') code: string): Promise<VerificationResultDto> {
    return this.verificationService.verify(code);
  }

  @Get()
  @ApiOperation({ summary: 'Sugiere codigos a partir de los ultimos caracteres escritos.' })
  @ApiOkResponse({ type: [String] })
  suggest(@Query() query: SuggestVerificationCodesDto): Promise<string[]> {
    return this.verificationService.suggest(query.q ?? '', query.limit);
  }
}