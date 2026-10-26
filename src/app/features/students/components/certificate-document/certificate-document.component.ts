import { Component, computed, inject, input, signal } from '@angular/core';
import { CreditService } from '../../../../core/services/credit.service';
import { EventService } from '../../../../core/services/event.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  AcademicEvent,
  PARTICIPATION_TYPE_LABEL,
  Participation,
  ParticipationType,
  REQUIRED_CREDITS,
  Student,
  buildCertificateValidationCode,
  eventDateRangeLabel,
  meetsCertificateRequirement,
} from '../../../../models';
import { CertificateCodeComponent } from '../../../../shared/components/ui/certificate-code/certificate-code.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { formatLongDate } from '../../../../shared/utils/date.utils';

interface CertificateRow {
  participation: Participation;
  event: AcademicEvent | undefined;
}

/**
 * DOCUMENTO DE LA CONSTANCIA DE CREDITOS.
 *
 * Es la hoja formal: reune los datos del estudiante, el detalle de cada
 * participacion con su codigo de verificacion y los datos de seguridad con los
 * que la constancia se puede validar.
 *
 * Disenada para imprimirse en UNA hoja A4: no lleva controles interactivos
 * dentro del area imprimible (el boton de copiar va marcado con `dc-no-print`).
 *
 * Es la pieza que reutilizan tanto la vista en modal como la ruta directa.
 */
@Component({
  selector: 'dc-certificate-document',
  imports: [CertificateCodeComponent, EmptyStateComponent, IconComponent],
  templateUrl: './certificate-document.component.html',
})
export class CertificateDocumentComponent {
  private readonly studentService = inject(StudentService);
  private readonly eventService = inject(EventService);
  private readonly creditService = inject(CreditService);

  readonly studentId = input.required<string>();

  readonly requiredCredits = REQUIRED_CREDITS;

  readonly copied = signal(false);

  readonly student = computed<Student | undefined>(() =>
    this.studentService.findById(this.studentId())
  );

  readonly summary = computed(() => this.creditService.getStudentCreditSummary(this.studentId()));

  /** true cuando el estudiante cumple el minimo y el certificado es emitible. */
  readonly meetsRequirement = computed(() =>
    meetsCertificateRequirement(this.summary().totalCredits)
  );

  /** Participaciones vigentes: son las que acreditan el certificado. */
  readonly rows = computed<CertificateRow[]>(() =>
    this.creditService
      .getStudentHistory(this.studentId())
      .filter((participation) => participation.status === 'VALID')
      .map((participation) => ({
        participation,
        event: this.eventService.findById(participation.eventId),
      }))
  );

  /** Codigo general de validacion del documento. */
  readonly validationCode = computed(() => {
    const student = this.student();
    return student ? buildCertificateValidationCode(student) : '';
  });

  /** Ruta de consulta con la que se valida el documento. */
  readonly verificationPath = computed(
    () => `/verify?tipo=constancia&codigo=${this.validationCode()}`
  );

  /** Fecha de emision del documento. */
  readonly issuedOn = formatLongDate(new Date());

  participationTypeLabel(type: ParticipationType): string {
    return PARTICIPATION_TYPE_LABEL[type];
  }

  eventDates(event: Pick<AcademicEvent, 'startDate' | 'endDate'>): string {
    return eventDateRangeLabel(event);
  }

  async copyValidationCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.validationCode());
    } catch {
      return;
    }

    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 2000);
  }
}
