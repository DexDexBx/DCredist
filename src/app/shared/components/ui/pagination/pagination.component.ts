import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * PAGINACION DE LISTAS GRANDES.
 *
 * El padron historico tiene cientos de miles de estudiantes: ninguna tabla puede
 * pintarlos todos. Este componente traduce una pagina de 1..N en la navegacion que
 * la persona ya conoce, y declara los parametros que van a la consulta.
 *
 * Es presentacional: recibe `page`, `pageCount`, `pageSize`, `total`, `from` y
 * `to`, y emite la pagina o el tamano pedido. No sabe de donde vienen los datos.
 */
@Component({
  selector: 'dc-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './pagination.component.html',
})
export class PaginationComponent {
  /** Pagina actual, 1-based. */
  readonly page = input.required<number>();
  /** Total de paginas disponibles. Siempre >= 1. */
  readonly pageCount = input.required<number>();
  /** Total de elementos que cumplen los filtros, no los de la pagina. */
  readonly total = input.required<number>();
  /** Primer elemento mostrado (1-based). 0 si la pagina esta vacia. */
  readonly from = input.required<number>();
  /** Ultimo elemento mostrado (1-based). */
  readonly to = input.required<number>();
  /** Tamano de pagina actual. */
  readonly pageSize = input.required<number>();

  /** Tamaños ofrecidos. El backend puede fijar un maximo. */
  readonly pageSizes = input<readonly number[]>([25, 50, 100, 200]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  readonly isEmpty = computed(() => this.total() === 0);

  readonly canGoBack = computed(() => this.page() > 1);
  readonly canGoForward = computed(() => this.page() < this.pageCount());

  /**
   * Numeros de pagina visibles, con `null` en los puntos de salto.
   *
   * Con 9 000 paginas no se pueden pintar 9 000 botones: se muestran las
   * vecinas a la actual y los extremos, que es lo que se usa en la practica.
   */
  readonly pageNumbers = computed<(number | null)[]>(() => {
    const last = this.pageCount();
    const current = this.page();

    if (last <= 7) {
      return Array.from({ length: last }, (_, index) => index + 1);
    }

    const pages: (number | null)[] = [1];

    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);

    if (start > 2) {
      pages.push(null);
    }
    for (let index = start; index <= end; index++) {
      pages.push(index);
    }
    if (end < last - 1) {
      pages.push(null);
    }

    pages.push(last);
    return pages;
  });

  readonly summary = computed(() => {
    const from = this.from();
    const to = this.to();
    const total = this.total();

    return total === 0
      ? 'Sin resultados'
      : `Mostrando ${formatThousands(from)}–${formatThousands(to)} de ${formatThousands(total)}`;
  });

  goTo(page: number): void {
    const target = Math.min(Math.max(1, page), this.pageCount());
    if (target !== this.page()) {
      this.pageChange.emit(target);
    }
  }

  onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isFinite(value) && value > 0) {
      this.pageSizeChange.emit(value);
    }
  }
}

/** Miles con separador de miles: los totales del padron son de seis cifras. */
function formatThousands(value: number): string {
  return new Intl.NumberFormat('es-PE').format(value);
}