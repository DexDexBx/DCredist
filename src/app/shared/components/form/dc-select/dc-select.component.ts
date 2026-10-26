import { Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let sequence = 0;

export interface DcSelectOption {
  value: string;
  label: string;
  /** Texto secundario que se muestra bajo la etiqueta (por ejemplo el organizador). */
  description?: string;
  /** Texto adicional sobre el que busca el combobox; no se muestra. */
  search?: string;
}

@Component({
  selector: 'dc-select',
  templateUrl: './dc-select.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DcSelectComponent),
      multi: true,
    },
  ],
})
export class DcSelectComponent implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly options = input<DcSelectOption[]>([]);
  readonly placeholder = input<string>('Selecciona una opción');
  readonly hint = input<string>('');
  readonly required = input(false);
  readonly invalid = input(false);

  readonly controlId = `dc-select-${++sequence}`;
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

  onSelect(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      this.value.set(target.value);
      this.onChange(target.value);
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  fieldClasses(): string {
    const base =
      'h-11 w-full appearance-none rounded-xl border bg-white px-3.5 pr-10 text-sm text-gray-900 shadow-theme-xs transition-colors focus:ring-3 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-white/[0.03] dark:text-white/90 dark:disabled:bg-white/[0.02]';

    return this.invalid()
      ? `${base} border-error-400 focus:border-error-500 focus:ring-error-500/15 dark:border-error-500/60`
      : `${base} border-gray-300 focus:border-brand-600 focus:ring-brand-500/15 dark:border-gray-700`;
  }
}
