import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'dc-page-header',
  imports: [RouterLink],
  templateUrl: './page-header.component.html',
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');

  readonly breadcrumbs = input<{ label: string; link?: string }[]>([]);
}
