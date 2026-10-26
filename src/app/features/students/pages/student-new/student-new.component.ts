import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  StudentImportRow,
  StudentImportSummary,
  StudentService,
} from '../../../../core/services/student.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { StudentStatus } from '../../../../models';
import { DcInputComponent } from '../../../../shared/components/form/dc-input/dc-input.component';
import { DcSelectComponent, DcSelectOption } from '../../../../shared/components/form/dc-select/dc-select.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { parseDelimitedText } from '../../../../shared/utils/csv.utils';
import {
  IMPORT_FILE_ACCEPT,
  isImportFileSupported,
  readImportFileText,
} from '../../../../shared/utils/import-file.utils';
import { downloadXlsx } from '../../../../shared/utils/xlsx.utils';

/** Columnas esperadas en la importacion del padron, en este orden. */
const IMPORT_COLUMNS = [
  'Código universitario',
  'Apellidos',
  'Nombres',
  'Escuela profesional',
  'Sede',
] as const;

/**
 * ALTA DE ESTUDIANTES.
 *
 * Dos vias, ambas sobre el mismo padron:
 *  1. registro manual de un estudiante,
 *  2. importacion incremental (nunca reemplaza el padron existente).
 */
@Component({
  selector: 'dc-student-new',
  imports: [
    DcInputComponent,
    DcSelectComponent,
    IconComponent,
    PageHeaderComponent,
    PanelComponent,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './student-new.component.html',
})
export class StudentNewComponent {
  private readonly studentService = inject(StudentService);
  private readonly catalogService = inject(CatalogService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly importColumns = IMPORT_COLUMNS;

  /** Formatos que acepta el input de archivo de la importacion. */
  readonly fileAccept = IMPORT_FILE_ACCEPT;

  readonly createdCode = signal<string | null>(null);
  readonly duplicateCode = signal<string | null>(null);
  readonly importText = signal('');
  readonly importFileName = signal<string | null>(null);
  readonly isDragging = signal(false);
  readonly importFileError = signal<string | null>(null);
  readonly importSummary = signal<StudentImportSummary | null>(null);

  /** Las escuelas y sedes salen del catalogo administrable. */
  readonly schools = computed(() => this.catalogService.names('schools'));
  readonly sites = computed(() => this.catalogService.names('headquarters'));

  readonly statusOptions: DcSelectOption[] = (
    ['ACTIVE', 'INACTIVE'] as StudentStatus[]
  ).map((status) => ({
    value: status,
    label: status === 'ACTIVE' ? 'Activo' : 'Inactivo',
  }));

  readonly schoolOptions = computed<DcSelectOption[]>(() =>
    this.schools().map((school) => ({ value: school, label: school }))
  );

  readonly siteOptions = computed<DcSelectOption[]>(() =>
    this.sites().map((site) => ({ value: site, label: site }))
  );

  readonly form = this.fb.nonNullable.group({
    universityCode: ['', [Validators.required]],
    academicDegree: [''],
    lastName: ['', [Validators.required]],
    firstName: ['', [Validators.required]],
    professionalSchool: ['', [Validators.required]],
    headquarters: ['', [Validators.required]],
    status: ['ACTIVE' as StudentStatus, [Validators.required]],
  });

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    this.duplicateCode.set(null);

    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();

    if (this.studentService.existsUniversityCode(value.universityCode)) {
      this.duplicateCode.set(value.universityCode);
      return;
    }

    const student = await this.studentService.create(value);

    if (student) {
      this.createdCode.set(student.universityCode);
      this.form.reset({
        universityCode: '',
        academicDegree: '',
        lastName: '',
        firstName: '',
        professionalSchool: '',
        headquarters: '',
        status: 'ACTIVE',
      });
    }
  }

  onCancel(): void {
    void this.router.navigate(['/students']);
  }

  /** Importa el texto pegado. Solo agrega o completa, nunca borra. */
  async onImport(): Promise<void> {
    // Se parsea con una sola columna para que las filas incompletas lleguen a la
    // validacion y se reporten como invalidas, en vez de descartarse en silencio.
    const parsed = parseDelimitedText(this.importText(), 1);

    const rows: StudentImportRow[] = parsed.map((cells) => ({
      universityCode: cells[0] ?? '',
      lastName: cells[1] ?? '',
      firstName: cells[2] ?? '',
      professionalSchool: cells[3] ?? '',
      headquarters: cells[4] ?? '',
      academicDegree: cells[5] ?? '',
    }));

    this.importSummary.set(await this.studentService.importStudents(rows));
  }

  isInvalid(
    control:
      | 'universityCode'
      | 'lastName'
      | 'firstName'
      | 'professionalSchool'
      | 'headquarters'
  ): boolean {
    const field = this.form.controls[control];
    return field.touched && field.invalid;
  }

  loadExample(): void {
    this.importFileName.set(null);
    this.importFileError.set(null);
    this.importText.set(
      [
        '2219001;RAMIREZ;CAMILA;INGENIERIA DE SISTEMAS;TRUJILLO',
        '2219002;TORRES;ALEX;INGENIERIA DE SISTEMAS;TRUJILLO',
        '2219003;QUISPE;MILAGROS;CONTABILIDAD;TRUJILLO',
        '2219004;CORDOVA;RICARDO;ADMINISTRACION Y NEGOCIOS;TRUJILLO',
      ].join('\n')
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.readImportFile(file);
    }
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.readImportFile(file);
    }
  }

  /** El archivo (Excel o texto) se convierte a filas y se pega en el area de texto. */
  private async readImportFile(file: File): Promise<void> {
    if (!isImportFileSupported(file)) {
      this.importFileError.set('Formato no admitido. Usa un archivo .xlsx, .csv o .txt.');
      return;
    }

    try {
      const text = await readImportFileText(file);
      this.importFileName.set(file.name);
      this.importText.set(text);
      this.importFileError.set(null);
      this.importSummary.set(null);
    } catch {
      this.importFileError.set('No se pudo leer el archivo seleccionado.');
    }
  }

  clearImportFile(): void {
    this.importFileName.set(null);
  }

  /** Plantilla en blanco con el encabezado de columnas, lista para rellenar en Excel. */
  downloadImportTemplate(): void {
    void downloadXlsx({
      fileName: 'DCredits_plantilla_padron_estudiantes',
      sheetName: 'Padron',
      rows: [[...IMPORT_COLUMNS, 'GRADO ACADÉMICO (opcional)']],
    });
  }
}
