import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { ConstancyService } from '../../../../core/services/constancy.service';
import { CreditService } from '../../../../core/services/credit.service';
import { EventService } from '../../../../core/services/event.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  AcademicEvent,
  ConstancyRecord,
  Participation,
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
  private readonly constancyService = inject(ConstancyService);

  readonly studentId = input.required<number>();
  readonly constancy = signal<ConstancyRecord | null>(null);
  private loadedForStudentId: number | null = null;

  constructor() {
    effect(() => {
      const student = this.student();
      if (!student || this.loadedForStudentId === student.id) {
        return;
      }

      this.loadedForStudentId = student.id;
      void this.loadConstancy(student.id);
    });
  }

  private async loadConstancy(studentId: number): Promise<void> {
    this.constancy.set(await this.constancyService.getForStudent(studentId));
  }

  readonly requiredCredits = REQUIRED_CREDITS;

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
    const stored = this.constancy();
    if (stored) {
      return stored.code;
    }

    // Respaldo visual mientras carga el API; el codigo oficial es el persistido.
    const student = this.student();
    return student ? buildCertificateValidationCode(student) : '';
  });

  /** Fecha de emision: la persistida en la constancia. */
  readonly issuedOn = computed(() => {
    const stored = this.constancy();
    return formatLongDate(stored ? stored.issuedAt : new Date());
  });

  eventDates(event: Pick<AcademicEvent, 'startDate' | 'endDate' | 'dateType'>): string {
    return eventDateRangeLabel(event);
  }

}
