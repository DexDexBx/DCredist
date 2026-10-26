import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from '../../events/dto/event-participant.dto';

export class SchoolCreditSummaryDto {
  @ApiProperty({ example: 'INGENIERIA DE SISTEMAS' })
  professionalSchool!: string;

  @ApiProperty({ example: 42 }) students!: number;
  @ApiProperty({ example: 40 }) activeStudents!: number;
  @ApiProperty({ example: 96 }) participations!: number;
  @ApiProperty({ example: 90 }) validParticipations!: number;
  @ApiProperty({ example: 120.5, description: 'Creditos vigentes de la escuela.' })
  totalCredits!: number;
}

export class TopStudentDto {
  @ApiProperty() studentId!: string;
  @ApiProperty({ example: 'MARISOL SONIA AGUILAR PEREZ' }) name!: string;
  @ApiProperty({ example: '2213271' }) universityCode!: string;
  @ApiProperty({ example: 4.5 }) credits!: number;
  @ApiProperty({ example: 3 }) participations!: number;
}

/**
 * Avance global hacia la meta institucional.
 *
 * `averageProgress` es la media de los estudiantes que ya tienen creditos
 * (quien tiene 0 no aporta al promedio) y `studentsCompleted` cuenta a quien ya
 * alcanzo la meta. Todo se calcula al vuelo: si la meta cambia, estos numeros
 * cambian sin tocar datos.
 */
export class CreditsProgressDto {
  @ApiProperty({ example: 21, description: 'Meta institucional vigente.' })
  creditsTarget!: number;

  @ApiProperty({ example: 5120.5, description: 'Creditos vigentes en todo el sistema.' })
  totalCredits!: number;

  @ApiProperty({ example: 64, description: 'Creditos que faltan en total para completar la meta de todos.' })
  remainingCredits!: number;

  @ApiProperty({ example: 21.4, description: 'Avance promedio de quien ya tiene creditos.' })
  averageProgress!: number;

  @ApiProperty({ example: 12, description: 'Estudiantes que ya alcanzaron la meta.' })
  studentsCompleted!: number;

  @ApiProperty({ example: 180, description: 'Estudiantes considerados en el promedio.' })
  studentsWithCredits!: number;

  @ApiProperty({ example: 312, description: 'Total del padron.' })
  totalStudents!: number;
}

/**
 * Cifras del inicio: todo se calcula en PostgreSQL, nada se cuenta en el
 * navegador ni se guarda como tabla de totales.
 */
export class DashboardSummaryDto {
  @ApiProperty({ example: 24 }) totalEvents!: number;
  @ApiProperty({ example: 3 }) activeEvents!: number;
  @ApiProperty({ example: 12 }) scheduledEvents!: number;
  @ApiProperty({ example: 8 }) completedEvents!: number;

  @ApiProperty({ example: 312 }) totalStudents!: number;
  @ApiProperty({ example: 298 }) activeStudents!: number;

  @ApiProperty({ example: 1840 }) totalParticipations!: number;
  @ApiProperty({ example: 5120.5, description: 'Creditos vigentes de todo el sistema.' })
  totalCredits!: number;

  @ApiProperty({ type: [EventSummaryDto], description: 'Eventos que empiezan hoy.' })
  todayEvents!: EventSummaryDto[];

  @ApiProperty({ type: [EventSummaryDto], description: 'Proximos eventos programados.' })
  nextEvents!: EventSummaryDto[];

  @ApiProperty({ type: [TopStudentDto] })
  topStudents!: TopStudentDto[];

  @ApiProperty({ type: [SchoolCreditSummaryDto] })
  schoolSummaries!: SchoolCreditSummaryDto[];

  @ApiProperty({ type: CreditsProgressDto, description: 'Avance global hacia la meta.' })
  creditsProgress!: CreditsProgressDto;
}