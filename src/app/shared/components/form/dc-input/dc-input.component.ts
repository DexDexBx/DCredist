import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let sequence = 0;

@Component({
  selector: 'dc-input',
  templateUrl: './dc-input.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DcInputComponent),
      multi: true,
    },
  ],
})
export class DcInputComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly type = input<'text' | 'email' | 'tel' | 'number' | 'date' | 'datetime-local'>('text');
  readonly placeholder = input<string>('');
  readonly hint = input<string>('');
  readonly required = input(false);
  readonly invalid = input(false);
  readonly autocomplete = input<string>('off');
  /** Valor mínimo (solo campos numéricos): evita negativos desde el navegador. */
  readonly min = input<number | null>(null);

  readonly controlId = `dc-input-${++sequence}`;
  readonly value = signal('');
  readonly disabled = signal(false);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.value.set(target.value);
      this.onChange(target.value);
    }
  }

  /** En campos numéricos se bloquean signos y notación exponencial. */
  onKeydown(event: KeyboardEvent): void {
    if (this.type() !== 'number') {
      return;
    }

    const blocked = ['e', 'E', '+', '-'];
    if (blocked.includes(event.key) && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  fieldClasses(): string {
    const base =
      'h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-gray-900 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:ring-3 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-white/[0.02]';

    return this.invalid()
      ? `${base} border-error-400 focus:border-error-500 focus:ring-error-500/15 dark:border-error-500/60`
      : `${base} border-gray-300 focus:border-brand-600 focus:ring-brand-500/15 dark:border-gray-700`;
  }
}
