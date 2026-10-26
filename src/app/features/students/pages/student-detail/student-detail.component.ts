import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreditService } from '../../../../core/services/credit.service';
import { EventService } from '../../../../core/services/event.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  AcademicEvent,
  EventStatus,
  PARTICIPATION_STATUS_LABEL,
  PARTICIPATION_TYPE_LABEL,
  Participation,
  ParticipationStatus,
  ParticipationType,
  REQUIRED_CREDITS,
  STUDENT_STATUS_LABEL,
  Student,
  eventDateRangeLabel,
  meetsCertificateRequirement,
  missingCreditsForCertificate,
  isLateParticipation,
  primaryCertificateCode,
} from '../../../../models';
import {
  BadgeColor,
  BadgeComponent,
} from '../../../../shared/components/ui/badge/badge.component';
import { CertificateCodeComponent } from '../../../../shared/components/ui/certificate-code/certificate-code.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { CertificateModalComponent } from '../../components/certificate-modal/certificate-modal.component';
import {
  EVENT_STATUS_COLOR,
  PARTICIPATION_STATUS_COLOR,
} from '../../../../shared/constants/status-ui';
import { formatDateTimeRange } from '../../../../shared/utils/date.utils';

/** Fila del historial: la participacion y su evento resuelto. */
interface HistoryRow {
  participation: Participation;
  event: AcademicEvent | undefined;
}

/** FICHA DEL ESTUDIANTE: datos permanentes + historial de participaciones. */
@Component({
  selector: 'dc-student-detail',
  imports: [
    BadgeComponent,
    CertificateCodeComponent,
    CertificateModalComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    RouterLink,
    StatCardComponent,
  ],
  templateUrl: './student-detail.component.html',
})
export class StudentDetailComponent {
  private readonly studentService = inject(StudentService);
  private readonly eventService = inject(EventService);
  private readonly creditService = inject(CreditService);

  /** Identificador tomado de la ruta /students/:id. */
  readonly id = input.required<string>();

  /** Controla la vista previa del certificado en modal. */
  readonly certificateOpen = signal(false);

  readonly statusLabel = STUDENT_STATUS_LABEL;
  readonly participationStatusLabel = PARTICIPATION_STATUS_LABEL;
  readonly requiredCredits = REQUIRED_CREDITS;

  readonly student = computed<Student | undefined>(() => this.studentService.findById(this.id()));

  readonly summary = computed(() => this.creditService.getStudentCreditSummary(this.id()));

  /** Solo con los 21 créditos se habilita la emisión del certificado. */
  readonly eligible = computed(() =>
    meetsCertificateRequirement(this.summary().totalCredits)
  );

  readonly missingCredits = computed(() =>
    missingCreditsForCertificate(this.summary().totalCredits)
  );

  readonly history = computed<HistoryRow[]>(() =>
    this.creditService
      .getStudentHistory(this.id())
      .map((participation) => ({
        participation,
        event: this.eventService.findById(participation.eventId),
      }))
  );

  /** Codigo con el que se abre la pantalla de verificacion. */
  codeOf(participation: Participation): string | null {
    return primaryCertificateCode(participation);
  }

  participationStatusColor(status: ParticipationStatus): BadgeColor {
    return PARTICIPATION_STATUS_COLOR[status];
  }

  eventStatusColor(status: EventStatus): BadgeColor {
    return EVENT_STATUS_COLOR[status];
  }

  participationTypeLabel(type: ParticipationType): string {
    return PARTICIPATION_TYPE_LABEL[type];
  }

  /** Registro que llego por una recarga extemporanea. */
  isLate(participation: Participation): boolean {
    return isLateParticipation(participation);
  }

  dateRange(start: string, end: string): string {
    return formatDateTimeRange(start, end);
  }

  eventDates(event: Pick<AcademicEvent, 'startDate' | 'endDate'>): string {
    return eventDateRangeLabel(event);
  }

  toggleStatus(): void {
    const student = this.student();
    if (!student) {
      return;
    }
    void this.studentService.setStatus(
      student.id,
      student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    );
  }

  openCertificate(): void {
    this.certificateOpen.set(true);
  }

  closeCertificate(): void {
    this.certificateOpen.set(false);
  }
}
