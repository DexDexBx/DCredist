import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  ConstancyVerificationResponse,
  VerificationOutcome,
  VerificationResponse,
  VerificationService,
} from '../../../../core/services/verification.service';
import { CreditService } from '../../../../core/services/credit.service';
import {
  PARTICIPATION_STATUS_LABEL,
  PARTICIPATION_TYPE_LABEL,
  REQUIRED_CREDITS,
  AcademicEvent,
  Participation,
  eventDateRangeLabel,
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
import {
  EVENT_STATUS_COLOR,
  PARTICIPATION_STATUS_COLOR,
} from '../../../../shared/constants/status-ui';
import { formatDateTimeRange, formatLongDate } from '../../../../shared/utils/date.utils';

/** Tipo de documento que se esta verificando. */
export type VerificationKind = 'CERTIFICATE' | 'CONSTANCY';

const OUTCOME_STYLES: Record<VerificationOutcome, string> = {
  VALID: 'border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10',
  CANCELLED: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]',
  NOT_FOUND: 'border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10',
  INVALID_FORMAT:
    'border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/10',
  NOT_ISSUED: 'border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/10',
};

const OUTCOME_ICON: Record<VerificationOutcome, 'check' | 'close' | 'info'> = {
  VALID: 'check',
  CANCELLED: 'info',
  NOT_FOUND: 'close',
  INVALID_FORMAT: 'info',
  NOT_ISSUED: 'info',
};

/**
 * CONSULTA Y VALIDACION DE CODIGOS DE DCREDITS.
 *
 * Dos tipos de documento, con un submenu para cambiar entre ellos:
 *  - CERTIFICADOS: codigo por participacion (DC-AAAA-XXXXXX o el anterior).
 *  - CONSTANCIAS:  codigo de la constancia de creditos (CONST-<codigo>-XXXXXX),
 *    que es un documento a nivel estudiante.
 */
@Component({
  selector: 'dc-verification',
  imports: [
    BadgeComponent,
    CertificateCodeComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    RouterLink,
  ],
  templateUrl: './verification.component.html',
})
export class VerificationComponent {
  private readonly verificationService = inject(VerificationService);
  private readonly creditService = inject(CreditService);
  private readonly route = inject(ActivatedRoute);

  readonly requiredCredits = REQUIRED_CREDITS;

  /** Permite llegar desde la ficha del estudiante con ?codigo=... y ?tipo=... */
  private readonly queryCode = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('codigo') ?? '')),
    { initialValue: '' }
  );

  private readonly queryKind = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('tipo') ?? '')),
    { initialValue: '' }
  );

  readonly kind = signal<VerificationKind>(this.initialKind());
  readonly code = signal(this.queryCode());
  readonly response = signal<VerificationResponse | null>(null);
  readonly constancy = signal<ConstancyVerificationResponse | null>(null);

  readonly statusLabel = PARTICIPATION_STATUS_LABEL;
  readonly typeLabel = PARTICIPATION_TYPE_LABEL;

  readonly suggestions = computed(() =>
    this.kind() === 'CONSTANCY' || this.response()
      ? []
      : this.verificationService.suggest(this.code())
  );

  readonly hasSearched = computed(() =>
    this.kind() === 'CONSTANCY' ? this.constancy() !== null : this.response() !== null
  );

  private readonly activeOutcome = computed<VerificationOutcome | null>(() =>
    this.kind() === 'CONSTANCY'
      ? this.constancy()?.outcome ?? null
      : this.response()?.outcome ?? null
  );

  private initialKind(): VerificationKind {
    const tipo = this.queryKind().trim().toLowerCase();
    if (tipo === 'constancia') {
      return 'CONSTANCY';
    }
    if (tipo === 'certificado') {
      return 'CERTIFICATE';
    }
    return this.queryCode().trim().toUpperCase().startsWith('CONST-')
      ? 'CONSTANCY'
      : 'CERTIFICATE';
  }

  selectKind(kind: VerificationKind): void {
    if (this.kind() === kind) {
      return;
    }
    this.kind.set(kind);
    this.onClear();
  }

  panelClass(): string {
    return OUTCOME_STYLES[this.activeOutcome() ?? 'NOT_FOUND'];
  }

  iconName(): 'check' | 'close' | 'info' {
    return OUTCOME_ICON[this.activeOutcome() ?? 'NOT_FOUND'];
  }

  onVerify(): void {
    if (this.kind() === 'CONSTANCY') {
      this.constancy.set(this.verificationService.verifyConstancy(this.code()));
      return;
    }
    this.response.set(this.verificationService.verify(this.code()));
  }

  onClear(): void {
    this.code.set('');
    this.response.set(null);
    this.constancy.set(null);
  }

  pick(suggestion: string): void {
    this.code.set(suggestion);
    this.onVerify();
  }

  /** Codigo con el que se verifica: el DC si existe y, si no, el del sistema anterior. */
  codeOf(participation: Participation): string {
    return primaryCertificateCode(participation) ?? '';
  }

  participationStatusColor(status: keyof typeof PARTICIPATION_STATUS_LABEL): BadgeColor {
    return PARTICIPATION_STATUS_COLOR[status];
  }

  eventStatusColor(status: keyof typeof EVENT_STATUS_COLOR): BadgeColor {
    return EVENT_STATUS_COLOR[status];
  }

  dateRange(start: string, end: string): string {
    return formatDateTimeRange(start, end);
  }

  eventDates(event: Pick<AcademicEvent, 'startDate' | 'endDate'>): string {
    return eventDateRangeLabel(event);
  }

  /** Fecha de emision de la constancia, ya formateada. */
  constancyIssuedOn(iso: string | null): string {
    return iso ? formatLongDate(iso) : 'Sin fecha registrada';
  }

  /** Creditos acumulados del estudiante verificado, no solo los del evento. */
  totalCredits(): number {
    const student = this.response()?.result?.student;
    return student ? this.creditService.getStudentCreditSummary(student.id).totalCredits : 0;
  }
}
