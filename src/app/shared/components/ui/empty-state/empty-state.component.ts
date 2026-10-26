import { Component, input } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'dc-empty-state',
  imports: [IconComponent],
  templateUrl: './empty-state.component.html',
})
export class EmptyStateComponent {
  readonly title = input<string>('Sin registros');
  readonly description = input<string>('');
}
