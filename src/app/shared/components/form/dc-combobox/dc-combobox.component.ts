import {
  Component,
  ElementRef,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { DcSelectOption } from '../dc-select/dc-select.component';
import {
  matchesTokens,
  normalizeForSearch,
  searchTokens,
} from '../../../../shared/utils/text.utils';

let sequence = 0;

/**
 * SELECT CON BUSQUEDA.
 *
 * Es un `ControlValueAccessor` que reemplaza al `<select>` nativo cuando la
 * lista es larga y hay que encontrar una opcion escribiendo. Filtra por la
 * etiqueta, la descripcion y el texto de busqueda de cada opcion, de modo que
 * un evento se pueda localizar por codigo, nombre u organizador.
 */
@Component({
  selector: 'dc-combobox',
  templateUrl: './dc-combobox.component.html',
  host: { class: 'block' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DcComboboxComponent),
      multi: true,
    },
  ],
})
export class DcComboboxComponent implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly label = input<string>('');
  readonly options = input<DcSelectOption[]>([]);
  readonly placeholder = input<string>('Buscar...');
  readonly hint = input<string>('');
  readonly required = input(false);
  readonly invalid = input(false);
  readonly emptyText = input<string>('Sin resultados');

  readonly controlId = `dc-combobox-${++sequence}`;
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(-1);

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  readonly selectedOption = computed(() =>
    this.options().find((option) => option.value === this.value()) ?? null
  );

  readonly filtered = computed(() => {
    const tokens = searchTokens(this.query());
    if (tokens.length === 0) {
      return this.options();
    }
    return this.options().filter((option) =>
      matchesTokens(
        this.searchableText(option),
        tokens
      )
    );
  });

  /** Lo que se ve en el campo: el texto buscado abierto, o la seleccion cerrada. */
  readonly fieldText = computed(() => {
    if (this.open()) {
      return this.query();
    }
    return this.selectedOption()?.label ?? '';
  });

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
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.open.set(true);
    this.query.set(target.value);
    this.activeIndex.set(0);
  }

  onFocus(): void {
    if (this.disabled()) {
      return;
    }
    this.open.set(true);
    this.query.set('');
    const selected = this.filtered().findIndex((option) => option.value === this.value());
    this.activeIndex.set(selected >= 0 ? selected : 0);
  }

  onBlur(): void {
    this.close();
    this.onTouched();
  }

  select(option: DcSelectOption): void {
    this.value.set(option.value);
    this.onChange(option.value);
    this.close();
  }

  clear(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.value.set('');
    this.onChange('');
    this.query.set('');
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }

    const results = this.filtered();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.open.set(true);
        this.move(1, results.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.open.set(true);
        this.move(-1, results.length);
        break;
      case 'Enter':
        if (this.open() && results.length > 0) {
          event.preventDefault();
          const option = results[this.clampIndex(results.length)];
          if (option) {
            this.select(option);
          }
        }
        break;
      case 'Escape':
        this.close();
        break;
      default:
        break;
    }
  }

  optionId(index: number): string {
    return `${this.controlId}-option-${index}`;
  }

  fieldClasses(): string {
    const base =
      'h-11 w-full rounded-xl border bg-white ps-10 pe-10 text-sm text-gray-900 shadow-theme-xs transition-colors placeholder:text-gray-400 focus:ring-3 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-gray-500 dark:disabled:bg-white/[0.02]';

    return this.invalid()
      ? `${base} border-error-400 focus:border-error-500 focus:ring-error-500/15 dark:border-error-500/60`
      : `${base} border-gray-300 focus:border-brand-600 focus:ring-brand-500/15 dark:border-gray-700`;
  }

  private move(step: number, length: number): void {
    if (length === 0) {
      this.activeIndex.set(-1);
      return;
    }
    const current = this.activeIndex();
    const next = current < 0 ? 0 : (current + step + length) % length;
    this.activeIndex.set(next);
  }

  private clampIndex(length: number): number {
    return Math.min(Math.max(this.activeIndex(), 0), length - 1);
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
    this.activeIndex.set(-1);
  }

  private searchableText(option: DcSelectOption): string {
    return normalizeForSearch(
      `${option.label} ${option.description ?? ''} ${option.search ?? ''}`
    );
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }
}
