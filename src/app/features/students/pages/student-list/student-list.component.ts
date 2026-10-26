import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  STUDENT_STATUS_LABEL,
  Student,
  StudentQuery,
  StudentSortKey,
  StudentStatus,
} from '../../../../models';
import { CreditService } from '../../../../core/services/credit.service';
import { AuthService } from '../../../../core/services/auth.service';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ExportService } from '../../../../core/services/export.service';
import { ParticipationService } from '../../../../core/services/participation.service';
import { StudentService } from '../../../../core/services/student.service';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/ui/empty-state/empty-state.component';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';
import { PaginationComponent } from '../../../../shared/components/ui/pagination/pagination.component';
import { PanelComponent } from '../../../../shared/components/ui/panel/panel.component';
import { StatCardComponent } from '../../../../shared/components/ui/stat-card/stat-card.component';
import { CertificateModalComponent } from '../../components/certificate-modal/certificate-modal.component';
import { STUDENT_STATUS_COLOR } from '../../../../shared/constants/status-ui';

interface StudentRow {
  student: Student;
  credits: number;
  creditsTarget: number;
  progress: number;
  completed: boolean;
  participations: number;
  pendingGrades: number;
  /** Indice de la fila, para escalonar la entrada en pantalla. */
  position: number;
}

const SORT_OPTIONS: { value: StudentSortKey; label: string }[] = [
  { value: 'name', label: 'Apellidos y nombres' },
  { value: 'code', label: 'Código universitario' },
  { value: 'recent', label: 'Carga más reciente' },
];

/** PADRON DE ESTUDIANTES: listado con busqueda, filtros y paginacion. */
@Component({
  selector: 'dc-student-list',
  imports: [
    BadgeComponent,
    CertificateModalComponent,
    EmptyStateComponent,
    FormsModule,
    IconComponent,
    PageHeaderComponent,
    PaginationComponent,
    PanelComponent,
    RouterLink,
    StatCardComponent,
  ],
  templateUrl: './student-list.component.html',
})
export class StudentListComponent {
  private readonly studentService = inject(StudentService);
  private readonly creditService = inject(CreditService);
  private readonly exportService = inject(ExportService);
  private readonly participationService = inject(ParticipationService);
  readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);

  readonly statusLabel = STUDENT_STATUS_LABEL;
  readonly sortOptions = SORT_OPTIONS;
  readonly creditsTarget = this.creditService.creditsTarget;

  /** Lo que la persona escribe. Se escribe aqui, se busca alli. */
  readonly searchInput = signal('');

  /** Estudiante cuyo certificado se esta previsualizando en el modal. */
  readonly certificateStudentId = signal<string | null>(null);

  /**
   * Texto realmente buscado.
   *
   * Escribir "MARIA FERNANDEZ" en un padron de 260 000 filas recalcula la
   * lista en cada tecla. El debounce agrupa la escritura: se busca cuando la
   * persona deja de teclear, no cuando pulsa cada letra.
   */
  readonly search = toSignal(
    toObservable(this.searchInput).pipe(debounceTime(250), distinctUntilChanged()),
    { initialValue: '' }
  );

  readonly school = signal('');
  readonly site = signal('');
  readonly status = signal<StudentStatus | 'Todos'>('Todos');
  readonly sort = signal<StudentSortKey>('name');
  readonly pageSize = signal(25);

  /**
   * Pagina visible.
   *
   * `linkedSignal`: la pagina vale 1 siempre que los filtros no cambien, pero en
   * cuanto cambian vuelve a 1 sola. Sin esto, cada manejador de filtro tendria
   * que acordarse de reiniciarla, y olvidarse deja a la persona en una pagina
   * vacia con la lista rota.
   */
  readonly page = linkedSignal({
    source: () =>
      `${this.search()}|${this.school()}|${this.site()}|${this.status()}|${this.sort()}`,
    computation: () => 1,
  });

  /**
   * Opciones de filtro: los nombres activos del catalogo mas los que ya aparecen
   * en el padron. Si un valor queda inactivo en el catalogo se sigue pudiendo
   * filtrar mientras haya estudiantes con ese valor.
   */
  readonly schools = computed(() =>
    this.mergeWithCatalog('schools', this.studentService.countBySchool()),
  );

  readonly sites = computed(() =>
    this.mergeWithCatalog('headquarters', this.studentService.countByHeadquarters()),
  );

  private mergeWithCatalog(
    kind: 'schools' | 'headquarters',
    inUse: Map<string, number>,
  ): string[] {
    const names = new Set(this.catalogService.names(kind));
    for (const name of inUse.keys()) {
      if (name.trim()) {
        names.add(name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'));
  }

  readonly query = computed<StudentQuery>(() => {
    const currentStatus = this.status();
    return {
      search: this.search(),
      professionalSchool: this.school() || undefined,
      headquarters: this.site() || undefined,
      status: currentStatus === 'Todos' ? undefined : currentStatus,
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize(),
    };
  });

  /** La pagina que se pinta: 25 filas, nunca el padron completo. */
  readonly pageData = computed(() => this.studentService.getStudentsPage(this.query()));

  readonly rows = computed<StudentRow[]>(() => {
    const { items } = this.pageData();
    const summaries = this.creditService.getStudentCreditSummaries(items.map((s) => s.id));
    const target = this.creditService.creditsTarget;

    return items.map((student, position) => {
      const summary = summaries.get(student.id);
      return {
        student,
        credits: summary?.totalCredits ?? 0,
        creditsTarget: target,
        progress: summary?.progress ?? 0,
        completed: summary?.completed ?? false,
        participations: summary?.totalParticipations ?? 0,
        pendingGrades: summary?.pendingGrades ?? 0,
        position,
      };
    });
  });

  readonly totalAll = this.studentService.totalCount;
  readonly activeAll = this.studentService.activeCount;

  /** Estudiantes del padron completo que tienen alguna participacion registrada. */
  readonly participatingAll = computed(
    () => this.participationService.participatingStudentIds().size
  );

  readonly schoolsCount = computed(() => this.studentService.countBySchool().size);

  readonly hasResults = computed(() => this.pageData().total > 0);

  statusColor(status: StudentStatus) {
    return STUDENT_STATUS_COLOR[status];
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
  }

  goToPage(page: number): void {
    this.page.set(page);
  }

  onPageSizeChange(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.page.set(1);
  }

  onSortChange(sort: StudentSortKey): void {
    this.sort.set(sort);
  }

  isActiveSort(value: StudentSortKey): boolean {
    return this.sort() === value;
  }

  /** El padron se exporta por escuela: es el corte institucional. */
  exportPadron(): void {
    const professionalSchool = this.school();
    if (!professionalSchool) {
      return;
    }
    this.exportService.downloadSchoolStudents(professionalSchool);
  }

  hasFilters(): boolean {
    return Boolean(this.search() || this.school() || this.site() || this.status() !== 'Todos');
  }

  clearFilters(): void {
    this.searchInput.set('');
    this.school.set('');
    this.site.set('');
    this.status.set('Todos');
  }

  /** Atajo: buscar por codigo escribiendo el termino completo. */
  isCodeSearch(): boolean {
    const term = this.search().trim();
    return term.length > 0 && /\d/.test(term);
  }

  openCertificate(studentId: string): void {
    this.certificateStudentId.set(studentId);
  }

  closeCertificate(): void {
    this.certificateStudentId.set(null);
  }
}