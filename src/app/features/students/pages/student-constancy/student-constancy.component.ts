import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreditService } from '../../../../core/services/credit.service';
import { EventService } from '../../../../core/services/event.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  AcademicEvent,
  REQUIRED_CREDITS,
  PARTICIPATION_STATUS_LABEL,
  PARTICIPATION_TYPE_LABEL,
  Participation,
  ParticipationStatus,
  ParticipationType,
  Student,
  eventDateRangeLabel,
  meetsCertificateRequirement,
  missingCreditsForCertificate,
  primaryCertificateCode,
} from '../../../../models';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';
import { CertificateCodeComponent } from '../../../../shared/components/ui/certificate-code/certificate-code.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { PARTICIPATION_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import { formatDateTimeRange } from '../../../../shared/utils/date.utils';

interface HistoryRow {
  participation: Participation;
  event: AcademicEvent | undefined;
}

/**
 * CONSTANCIA DE AVANCE DE CREDITOS.
 *
 * Es el documento informativo: muestra cuanto lleva acumulado el estudiante y
 * si ya alcanzo el minimo para su certificado. NO emite el certificado; cuando
 * cumple, ofrece el enlace a la vista formal.
 */
@Component({
  selector: 'dc-student-constancy',
  imports: [
    BadgeComponent,
    CertificateCodeComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    RouterLink,
    StatCardComponent,
  ],
  templateUrl: './student-constancy.component.html',
})
export class StudentConstancyComponent {
  private readonly studentService = inject(StudentService);
  private readonly eventService = inject(EventService);
  private readonly creditService = inject(CreditService);

  readonly id = input.required<string>();

  readonly requiredCredits = REQUIRED_CREDITS;
  readonly statusLabel = PARTICIPATION_STATUS_LABEL;

  readonly student = computed<Student | undefined>(() => this.studentService.findById(this.id()));

  readonly summary = computed(() => this.creditService.getStudentCreditSummary(this.id()));

  /** true cuando el estudiante ya puede emitir su certificado. */
  readonly meetsRequirement = computed(() =>
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

  participationTypeLabel(type: ParticipationType): string {
    return PARTICIPATION_TYPE_LABEL[type];
  }

  participationStatusColor(status: ParticipationStatus) {
    return PARTICIPATION_STATUS_COLOR[status];
  }

  eventDates(event: Pick<AcademicEvent, 'startDate' | 'endDate'>): string {
    return eventDateRangeLabel(event);
  }

  dateRange(start: string, end: string): string {
    return formatDateTimeRange(start, end);
  }

  codeOf(participation: Participation): string | null {
    return primaryCertificateCode(participation);
  }
}
