import { Component, computed, input, signal } from '@angular/core';
import { normalizeVerificationCode } from '../../../../models';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'dc-code',
  imports: [IconComponent],
  templateUrl: './dc-code.component.html',
})
export class DcCodeComponent {
  readonly code = input.required<string | null | undefined>();
  readonly label = input<string>('Código de verificación');
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  readonly copied = signal(false);
  readonly hasCode = computed(() => Boolean(this.code()));

  async copy(): Promise<void> {
    const value = this.code();
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }

    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 2000);
  }

  normalized(): string {
    return normalizeVerificationCode(this.code() ?? '');
  }
}
