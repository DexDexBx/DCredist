import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

/**
 * BARRA DE AVANCE HACIA LA META DE CREDITOS.
 *
 * Es presentacional: recibe los numeros ya calculados (el avance total, la meta
 * y el color) y no sabe de donde salen. Quien calcula es CreditService, que los
 * deriva de las participaciones vigentes, de modo que la barra nunca guarda un
 * porcentaje propio que pueda quedar desactualizado.
 */
@Component({
  selector: 'dc-credit-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './credit-progress.component.html',
})
export class CreditProgressComponent {
  /** Creditos acumulados: los que cuentan como VALID. */
  readonly credits = input.required<number>();
  /** Meta institucional. Por defecto, la meta vigente de DCredits. */
  readonly target = input<number>(21);
  /** Etiqueta visible a la izquierda de la barra. */
  readonly label = input<string>('Avance');
  /** Muestra el porcentaje al lado del valor. */
  readonly showPercent = input<boolean>(true);

  /** Ancho de la barra en porcentaje, acotado entre 0 y 100. */
  readonly width = computed(() => {
    const target = this.target();
    const credits = this.credits();

    if (target <= 0 || credits <= 0) {
      return 0;
    }

    return Math.min(100, (credits / target) * 100);
  });

  readonly completed = computed(() => this.credits() >= this.target() && this.target() > 0);

  /** Creditos que faltan. Cero cuando ya se cumplio la meta. */
  readonly remaining = computed(() => Math.max(0, Math.round((this.target() - this.credits()) * 100) / 100));

  readonly percent = computed(() => Math.round(this.width() * 10) / 10);

  readonly barClass = computed(() =>
    this.completed()
      ? 'bg-success-500'
      : this.width() >= 50
        ? 'bg-brand-600'
        : this.width() > 0
          ? 'bg-warning-500'
          : 'bg-gray-300 dark:bg-gray-700'
  );
}
