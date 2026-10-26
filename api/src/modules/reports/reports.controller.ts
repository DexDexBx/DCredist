import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreditsProgressDto,
  DashboardSummaryDto,
  SchoolCreditSummaryDto,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('schools/credits')
  @ApiOperation({
    summary: 'Creditos acumulados por escuela profesional.',
    description: 'Calculado con GROUP BY sobre students x participations. Solo suma participaciones VALID.',
  })
  @ApiOkResponse({ type: [SchoolCreditSummaryDto] })
  schoolCredits(): Promise<SchoolCreditSummaryDto[]> {
    return this.reportsService.schoolCredits();
  }

  @Get('credits/progress')
  @ApiOperation({
    summary: 'Avance global hacia la meta de creditos.',
    description:
      'Meta institucional (21 por defecto), creditos vigentes, promedio de avance y cuantos estudiantes ya la alcanzaron. Todo se calcula al vuelo.',
  })
  @ApiOkResponse({ type: CreditsProgressDto })
  creditsProgress(): Promise<CreditsProgressDto> {
    return this.reportsService.creditsProgress();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Cifras del inicio.',
    description:
      'Conteos de eventos y estudiantes, creditos vigentes del sistema, eventos de hoy, proximos eventos, top de estudiantes y resumen por escuela.',
  })
  @ApiOkResponse({ type: DashboardSummaryDto })
  dashboard(): Promise<DashboardSummaryDto> {
    return this.reportsService.dashboard();
  }
}