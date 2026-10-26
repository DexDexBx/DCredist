import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EventService } from '../../../../core/services/event.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import { StudentService } from '../../../../core/services/student.service';
import {
  CERTIFICATE_CODE_ORIGIN_LABEL,
  CodeReissueResult,
  PARTICIPATION_STATUS_LABEL,
  PARTICIPATION_TYPE_LABEL,
  Participation,
  ParticipationContext,
  certificateOrigin,
  generateVerificationCode,
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
import { PARTICIPATION_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import { formatMediumDate } from '../../../../shared/utils/date.utils';

/** Tope de la migracion masiva en una sola vez, para no bloquear la pantalla. */
const BULK_LIMIT = 200;

/**
 * MODULO DE CODIGOS DE CERTIFICADO.
 *
 * DCredits convive con el sistema anterior: hay certificados impreso con una
 * nomenclatura vieja. Este modulo es el puente.
 *
 * Permite cargar un codigo anterior, ver a quien corresponde, emitir el codigo
 * propio de DCredits y conservar el anterior. Nunca se borra el codigo que el
 * estudiante ya conoce: un certificado impreso tiene que seguir localizable.
 */
@Component({
  selector: 'dc-certificate-codes',
  imports: [
    BadgeComponent,
    CertificateCodeComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    RouterLink,
    StatCardComponent,
  ],
  templateUrl: './certificate-codes.component.html',
})
export class CertificateCodesComponent {
  /** Publico porque la tabla de pendientes lo usa directamente en la plantilla. */
  readonly participationService = inject(ParticipationService);
  private readonly eventService = inject(EventService);
  private readonly studentService = inject(StudentService);

  readonly statusLabel = PARTICIPATION_STATUS_LABEL;
  readonly typeLabel = PARTICIPATION_TYPE_LABEL;
  readonly originLabel = CERTIFICATE_CODE_ORIGIN_LABEL;

  /** Lo que escribe la persona: un codigo anterior o un codigo DC. */
  readonly lookupInput = signal('');

  /** Participacion encontrada para el codigo escrito. */
  readonly found = signal<ParticipationContext | null>(null);

  /** Aviso de la ultima accion. */
  readonly message = signal<string | null>(null);
  readonly messageTone = signal<'success' | 'warning' | 'error'>('success');

  /** Resultado visible del codigo recien emitido. */
  readonly issued = signal<CodeReissueResult | null>(null);

  /**
   * Codigo de ejemplo.
   *
   * Se genera en el momento y NO se guarda: es una muestra del formato, para que
   * quede claro como se ve uno nuevo sin tener que emitir uno de verdad.
   */
  readonly exampleDcCode = generateVerificationCode();

  /** Codigo de ejemplo del sistema anterior, con su propia nomenclatura. */
  readonly exampleLegacyCode = 'SIS/2019/008821';

  /**
   * Participaciones que ya tienen codigo del anterior y todavia no el DC.
   *
   * Se devuelven como contextos porque la tabla necesita el nombre del estudiante
   * y el del evento de cada fila.
   */
  readonly pending = computed<ParticipationContext[]>(() =>
    this.participationService
      .pendingCodeMigration()
      .filter((participation) => participation.status !== 'CANCELLED')
      .map((participation) => this.participationService.context(participation))
  );

  /** Ultimas participaciones migradas, para comprobar el resultado. */
  readonly recentlyIssued = computed(() =>
    this.participationService
      .participations()
      .filter(
        (participation) =>
          Boolean((participation.verificationCode ?? '').trim()) &&
          Boolean((participation.legacyCode ?? '').trim())
      )
      .slice(0, 8)
  );

  /** Codes ya migrados: sirve para explicar el resultado de la busqueda. */
  readonly migratedCount = computed(
    () =>
      this.participationService
        .participations()
        .filter(
          (participation) =>
            Boolean((participation.verificationCode ?? '').trim()) &&
            Boolean((participation.legacyCode ?? '').trim())
        ).length
  );

  /**
   * Busca la participacion a la que pertenece el codigo escrito.
   *
   * Admite las dos nomenclaturas: quien tiene un certificado impreso solo conoce
   * el codigo antiguo, y quien ya recibio el nuevo conoce el DC.
   */
  lookup(): void {
    const code = this.lookupInput().trim();

    if (!code) {
      this.found.set(null);
      this.message.set('Escribe un código para buscar.');
      this.messageTone.set('warning');
      return;
    }

    const participation = this.participationService.findByCertificateCode(code);
    this.issued.set(null);

    if (!participation) {
      this.found.set(null);
      this.message.set(
        `No se encontró ninguna participación con el código "${code}". Revisa que esté completo.`
      );
      this.messageTone.set('error');
      return;
    }

    this.found.set(this.participationService.context(participation));
    this.message.set(null);
  }

  /** Emite el codigo DC de la participacion encontrada. */
  issue(found: ParticipationContext): void {
    const result = this.participationService.assignDcCode(found.participation.id);
    this.report(result);

    if (result.outcome === 'CREATED') {
      // Se relee la participacion para mostrar el dato ya guardado.
      const updated = this.participationService
        .participations()
        .find((item) => item.id === found.participation.id);
      if (updated) {
        this.found.set(this.participationService.context(updated));
      }
    }
  }

  /** Emite de una vez los codigos que falten, hasta el tope de una tanda. */
  issueAll(): void {
    const results = this.participationService.assignMissingDcCodes(BULK_LIMIT);

    if (results.length === 0) {
      this.message.set('No hay códigos anteriores pendientes de convertir.');
      this.messageTone.set('success');
      return;
    }

    const created = results.filter((result) => result.outcome === 'CREATED').length;
    this.message.set(
      `Se emitieron ${created} códigos DC. Los códigos anteriores se conservan.`
    );
    this.messageTone.set('success');

    // Si lo que se estaba mirando ya recibio su codigo, se actualiza en pantalla.
    const current = this.found();
    if (current) {
      const updated = this.participationService
        .participations()
        .find((item) => item.id === current.participation.id);
      if (updated) {
        this.found.set(this.participationService.context(updated));
      }
    }
  }

  clear(): void {
    this.lookupInput.set('');
    this.found.set(null);
    this.message.set(null);
    this.issued.set(null);
  }

  canIssue(found: ParticipationContext): boolean {
    return (
      found.participation.verificationCode === null &&
      found.participation.status !== 'CANCELLED'
    );
  }

  originOf(participation: Participation): string {
    return this.originLabel[certificateOrigin(participation)];
  }

  statusColor(participation: Participation): BadgeColor {
    return PARTICIPATION_STATUS_COLOR[participation.status];
  }

  studentName(found: ParticipationContext): string {
    const student = found.student;
    return student ? `${student.lastName}, ${student.firstName}` : 'Estudiante no encontrado';
  }

  studentCode(found: ParticipationContext): string {
    return found.student?.universityCode ?? '';
  }

  eventName(found: ParticipationContext): string {
    return found.event?.name ?? 'Evento no disponible';
  }

  eventServiceName(eventId: string): string {
    return this.eventService.findById(eventId)?.name ?? 'Evento no disponible';
  }

  date(value: string): string {
    return formatMediumDate(value);
  }

  visibleCode(participation: Participation): string | null {
    return primaryCertificateCode(participation);
  }

  studentTotal(): number {
    return this.studentService.totalCount();
  }

  private report(result: CodeReissueResult): void {
    this.message.set(result.message);
    this.messageTone.set(
      result.outcome === 'CREATED' ? 'success' : result.outcome === 'CANCELLED' ? 'error' : 'warning'
    );
    if (result.outcome === 'CREATED') {
      this.issued.set(result);
    }
  }
}