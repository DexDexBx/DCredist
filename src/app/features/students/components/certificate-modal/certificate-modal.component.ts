import { Component, DestroyRef, HostListener, effect, inject, input, output } from '@angular/core';
import { CertificateDocumentComponent } from '../certificate-document/certificate-document.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { printCertificate } from '../../../../shared/utils/print.utils';

/**
 * MODAL DE LA CONSTANCIA.
 *
 * Muestra el documento en una capa a pantalla completa, para verlo e imprimirlo
 * sin salir de la ficha del estudiante. La impresion se delega en
 * `printCertificate()`, que imprime solo la hoja en un documento aislado.
 */
@Component({
  selector: 'dc-certificate-modal',
  imports: [CertificateDocumentComponent, IconComponent],
  templateUrl: './certificate-modal.component.html',
})
export class CertificateModalComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly studentId = input<string | null>(null);
  readonly isOpen = input(false);

  readonly close = output<void>();

  constructor() {
    effect(() => {
      document.body.style.overflow = this.isOpen() ? 'hidden' : '';
    });

    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close.emit();
    }
  }

  print(): void {
    printCertificate();
  }
}
