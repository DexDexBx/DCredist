import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  CertificateCodes,
  CERTIFICATE_CODE_ORIGIN_LABEL,
  certificateOrigin,
  primaryCertificateCode,
} from '../../../../models';
import { BadgeColor, BadgeComponent } from '../badge/badge.component';

/**
 * CODIGO DEL CERTIFICADO DE UNA PARTICIPACION.
 *
 * Muestra SIEMPRE un codigo (el DC si existe, y si no el del sistema anterior)
 * e indica de que nomenclatura viene. Un certificado migrado nunca se muestra
 * como si fuera del sistema nuevo, ni al reves.
 *
 * Es presentacional: recibe la participacion y no decide nada.
 */
@Component({
  selector: 'dc-certificate-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  templateUrl: './certificate-code.component.html',
})
export class CertificateCodeComponent {
  /** La participacion, o directamente el par de codigos. */
  readonly codes = input.required<CertificateCodes>();

  /** Muestra el badge con la nomenclatura de origen. */
  readonly showOrigin = input<boolean>(true);

  readonly origin = computed(() => certificateOrigin(this.codes()));

  readonly originLabel = computed(() => CERTIFICATE_CODE_ORIGIN_LABEL[this.origin()]);

  readonly code = computed(() => primaryCertificateCode(this.codes()));

  /** El legado se pinta en ambar: es historico, no vigente. */
  readonly isLegacy = computed(() => {
    const origin = this.origin();
    return origin === 'LEGACY' || origin === 'BOTH';
  });

  readonly badgeColor = computed<BadgeColor>(() => {
    switch (this.origin()) {
      case 'DCREDITS':
        return 'primary';
      case 'BOTH':
        return 'success';
      case 'LEGACY':
        return 'warning';
      default:
        return 'light';
    }
  });

  /** Los codigos anteriores conservan sus caracteres especiales al mostrarse. */
  monoClass = computed(() =>
    this.isLegacy()
      ? 'font-mono text-warning-700 dark:text-warning-400'
      : 'font-mono text-gray-700 dark:text-gray-200'
  );
}
