import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

/**
 * TARJETA DE CIFRA DESTACADA.
 *
 * Presenta un numero del sistema: estudiantes en el padron, completaron la meta,
 * creditos acreditados. Es presentacional y no sabe de donde sale el dato.
 *
 * ANIMACION DEL NUMERO: con un padron de cientos de miles de estudiantes, un
 * total que salta de 20 a 260 000 sin transicion deja ver el salto de golpe; un
 * numero que sube desde cero lo hace legible. La animacion:
 *  - arranca DESPUES del primer render contando desde cero,
 *  - se cancela sola si el valor cambia a mitad de camino,
 *  - no se ejecuta con `prefers-reduced-motion`, porque contar desde cero es
 *    exactamente el movimiento que esa preferencia desactiva.
 *
 * Se usa `requestAnimationFrame` y no una libreria de animacion: son veinte lineas
 * y evita sumar una dependencia al proyecto.
 */
@Component({
  selector: 'dc-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './stat-card.component.html',
})
export class StatCardComponent {
  private readonly destroyRef = inject(DestroyRef);

  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input<string>('');
  readonly tone = input<StatTone>('primary');
  /** Icono opcional de la tarjeta (de la coleccion de iconos del proyecto). */
  readonly icon = input<IconName>();

  /** Valor mostrado. Es el animado mientras corre, y el real al terminar. */
  readonly displayValue = signal<string | number>('');

  private readonly numericValue = computed(() => {
    const value = this.value();
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });

  private frame = 0;
  private ready = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelAnimation());

    effect(() => {
      const target = this.numericValue();

      // Un valor no numerico (por ejemplo "12 de 20") no se cuenta: se pinta tal
      // cual, porque animar texto parcial no tiene sentido.
      if (target === null) {
        this.cancelAnimation();
        this.displayValue.set(this.value());
        return;
      }

      // Antes del primer render, o si la persona pidio menos movimiento, el dato
      // se muestra de inmediato: una tarjeta que tarda medio segundo en decir
      // cuanto hay es peor que una tarjeta sin animacion.
      //
      // OJO: aqui no se escribe `displayValue` cuando va a animar. Si se hiciera,
      // `animateTo` leeria como origen el valor final, veria `from === target` y
      // no contaria nada.
      if (!this.ready || this.prefersReducedMotion()) {
        this.cancelAnimation();
        this.displayValue.set(target);
        return;
      }

      this.animateTo(target);
    });

    afterNextRender(() => {
      this.ready = true;

      const target = this.numericValue();
      if (target !== null && !this.prefersReducedMotion()) {
        // La primera vez el numero entra contando desde cero.
        this.animate(0, target);
      }
    });
  }

  toneBar(): string {
    return TONE_BAR[this.tone()];
  }

  toneIcon(): string {
    return TONE_ICON[this.tone()];
  }

  private currentNumber(): number {
    const shown = this.displayValue();
    return typeof shown === 'number' ? shown : 0;
  }

  /** Continua la cuenta desde el numero que hay en pantalla hasta `target`. */
  private animateTo(target: number): void {
    this.animate(this.currentNumber(), target);
  }

  /**
   * Cuenta de `from` a `to` en ~700 ms.
   *
   * Si la persona pidio menos movimiento, el valor final se pinta de inmediato:
   * una tarjeta que tarda medio segundo en mostrar el dato es peor que una
   * tarjeta sin animacion.
   */
  private animate(from: number, to: number): void {
    this.cancelAnimation();

    if (from === to) {
      this.displayValue.set(to);
      return;
    }

    const start = performance.now();
    const duration = 700;

    const step = (now: number): void => {
      const elapsed = Math.min(1, (now - start) / duration);
      // Salida suave: al principio avanza rapido y al final se asienta, en vez
      // de frenar en seco.
      const eased = 1 - Math.pow(1 - elapsed, 3);

      this.displayValue.set(Math.round(from + (to - from) * eased));

      if (elapsed < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        this.frame = 0;
        this.displayValue.set(to);
      }
    };

    this.frame = requestAnimationFrame(step);
  }

  private cancelAnimation(): void {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

type StatTone = 'primary' | 'success' | 'warning' | 'accent';

const TONE_BAR: Record<StatTone, string> = {
  primary: 'bg-brand-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  accent: 'bg-accent-400',
};

const TONE_ICON: Record<StatTone, string> = {
  primary: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400',
  accent: 'bg-accent-50 text-accent-700 dark:bg-accent-500/10 dark:text-accent-300',
};