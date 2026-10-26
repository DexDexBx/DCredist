import { Component, HostBinding, Input } from '@angular/core';

type BadgeVariant = 'light' | 'solid';
type BadgeSize = 'sm' | 'md';
export type BadgeColor =
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'light'
  | 'dark';

@Component({
  selector: 'app-badge',
  template: '<ng-content />',
  host: { class: 'inline-flex' },
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'light';
  @Input() size: BadgeSize = 'md';
  @Input() color: BadgeColor = 'primary';

  @HostBinding('class') get hostClasses(): string {
    return `inline-flex items-center justify-center gap-1 rounded-full font-medium ${this.sizeClass} ${this.colorClass}`;
  }

  get sizeClass(): string {
    return this.size === 'sm' ? 'px-2.5 py-0.5 text-theme-xs' : 'px-2.5 py-0.5 text-sm';
  }

  get colorClass(): string {
    const variants: Record<BadgeVariant, Record<BadgeColor, string>> = {
      light: {
        primary: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
        success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
        error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
        warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400',
        info: 'bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-500',
        light: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80',
        dark: 'bg-gray-700 text-white dark:bg-white/10 dark:text-white',
      },
      solid: {
        primary: 'bg-brand-700 text-white dark:bg-brand-700 dark:text-white',
        success: 'bg-success-600 text-white dark:bg-success-600 dark:text-white',
        error: 'bg-error-600 text-white dark:bg-error-600 dark:text-white',
        warning: 'bg-warning-500 text-white dark:bg-warning-500 dark:text-white',
        info: 'bg-blue-light-600 text-white dark:bg-blue-light-600 dark:text-white',
        light: 'bg-gray-400 text-white dark:bg-white/10 dark:text-white/80',
        dark: 'bg-gray-700 text-white dark:bg-gray-700 dark:text-white',
      },
    };
    return variants[this.variant][this.color];
  }
}
