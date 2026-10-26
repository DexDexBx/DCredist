import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly expandedState = signal(true);
  private readonly mobileOpenState = signal(false);
  private readonly hoveredState = signal(false);

  readonly isExpanded = this.expandedState.asReadonly();
  readonly isMobileOpen = this.mobileOpenState.asReadonly();
  readonly isHovered = this.hoveredState.asReadonly();

  /** El sidebar ocupa 290 px cuando esta desplegado y 90 px cuando esta colapsado. */
  readonly contentOffset = computed(
    () => (this.expandedState() || this.hoveredState() ? 'xl:ms-[290px]' : 'xl:ms-[90px]')
  );

  readonly asideWidth = computed(() =>
    this.expandedState() || this.hoveredState() || this.mobileOpenState()
      ? 'w-[290px]'
      : 'w-[90px]'
  );

  /** Los labels solo se muestran cuando el menu es legible. */
  readonly showLabels = computed(
    () => this.expandedState() || this.hoveredState() || this.mobileOpenState()
  );

  toggleExpanded(): void {
    this.expandedState.update((value) => !value);
  }

  setMobileOpen(value: boolean): void {
    this.mobileOpenState.set(value);
  }

  toggleMobileOpen(): void {
    this.mobileOpenState.update((value) => !value);
  }

  setHovered(value: boolean): void {
    this.hoveredState.set(value);
  }

  closeMobile(): void {
    this.mobileOpenState.set(false);
  }
}
