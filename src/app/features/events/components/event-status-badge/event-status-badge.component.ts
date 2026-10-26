import { Component, computed, input } from '@angular/core';
import { EventStatus } from '../../../../models';
import { EVENT_STATUS_COLOR } from '../../../../shared/constants/status-ui';
import { BadgeComponent } from '../../../../shared/components/ui/badge/badge.component';

@Component({
  selector: 'app-event-status-badge',
  imports: [BadgeComponent],
  template: `<app-badge
    size="sm"
    [color]="color()"
    [attr.aria-label]="'Estado del evento: ' + status()"
    >{{ status() }}</app-badge
  >`,
})
export class EventStatusBadgeComponent {
  readonly status = input.required<EventStatus>();

  readonly color = computed(() => EVENT_STATUS_COLOR[this.status()]);
}
