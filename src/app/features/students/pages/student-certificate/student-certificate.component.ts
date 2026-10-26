import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudentService } from '../../../../core/services/student.service';
import { Student } from '../../../../models';
import { CertificateDocumentComponent } from '../../components/certificate-document/certificate-document.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { printCertificate } from '../../../../shared/utils/print.utils';

/**
 * PAGINA DIRECTA DE LA CONSTANCIA (/students/:id/certificate).
 *
 * Es el punto de entrada por enlace directo: reutiliza el mismo documento que el
 * modal, para que la hoja sea identica se vea desde donde se vea.
 */
@Component({
  selector: 'dc-student-certificate',
  imports: [
    CertificateDocumentComponent,
    EmptyStateComponent,
    IconComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  templateUrl: './student-certificate.component.html',
})
export class StudentCertificateComponent {
  private readonly studentService = inject(StudentService);

  readonly id = input.required<string>();

  readonly student = computed<Student | undefined>(() => this.studentService.findById(this.id()));

  print(): void {
    printCertificate();
  }
}
