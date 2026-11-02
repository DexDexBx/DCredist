import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DateSelectInfo,
  DatesSetInfo,
  EventClickInfo,
  EventInput,
} from 'fullcalendar';
import { EventService } from '../../../../core/services/event.service';
import { AuthService } from '../../../../core/services/auth.service';
import {
  EVENT_STATUSES,
  AcademicEvent,
  EventStatus,
  eventDateRangeLabel,
} from '../../../../models';
import { EVENT_STATUS_HEX } from '../../../../shared/constants/status-ui';
import { IconComponent } from '../../../../shared/components/ui/icon/icon.component';
import { ModalComponent } from '../../../../shared/components/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/components/ui/page-header/page-header.component';

import { EventStatusBadgeComponent } from '../../components/event-status-badge/event-status-badge.component';
import { buildCalendarOptions } from './event-calendar.options';

interface SelectedEvent {
  id: number;
  name: string;
  code: string;
  status: AcademicEvent['status'];
  modality: AcademicEvent['modality'];
  location: string;
  schedule: string;
  range: string;
  organizer: string;
}

@Component({
  selector: 'app-event-calendar',
  imports: [
    RouterLink,
    FullCalendarModule,
    ModalComponent,
    IconComponent,
    PageHeaderComponent,
    EventStatusBadgeComponent,
  ],
  templateUrl: './event-calendar.component.html',
})
export class EventCalendarComponent {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly selected = signal<SelectedEvent | null>(null);
  readonly visibleRangeLabel = signal('');
  readonly statuses: readonly EventStatus[] = EVENT_STATUSES;

  statusColor(status: EventStatus): string {
    return EVENT_STATUS_HEX[status];
  }

  readonly events = computed<EventInput[]>(() =>
    this.eventService.events().map((event) => this.toEventInput(event))
  );

  readonly options = computed<CalendarOptions>(() =>
    buildCalendarOptions({
      events: this.events(),
      onEventClick: (info) => this.onEventClick(info),
      onRangeChange: (info) => this.onRangeChange(info),
      onDateSelect: (info) => this.onDateSelect(info),
    })
  );

  closeModal(): void {
    this.selected.set(null);
  }

  goToEvent(): void {
    const current = this.selected();
    if (current) {
      void this.router.navigate(['/events', current.id]);
    }
  }

  goToRegister(): void {
    const current = this.selected();
    void this.router.navigate(['/participations/register'], {
      queryParams: current ? { evento: current.id } : undefined,
    });
  }

  private toEventInput(event: AcademicEvent): EventInput {
    return {
      id: String(event.id),
      title: event.name,
      start: event.startDate,
      // FullCalendar trata `end` como exclusivo en eventos de todo el dia.
      end: addDays(event.endDate, 1),
      allDay: true,
      backgroundColor: EVENT_STATUS_HEX[event.status],
      borderColor: EVENT_STATUS_HEX[event.status],
      textColor: '#ffffff',
      extendedProps: {
        modality: event.modality,
        schedule: eventDateRangeLabel(event),
      },
    };
  }

  private onEventClick(info: EventClickInfo): void {
    const event = this.eventService.findById(Number(info.event.id));
    if (!event) {
      return;
    }

    this.selected.set({
      id: event.id,
      name: event.name,
      code: event.code,
      status: event.status,
      modality: event.modality,
      location: event.location ?? '',
      schedule: eventDateRangeLabel(event),
      range: eventDateRangeLabel(event),
      organizer: event.organizer ?? '',
    });
  }

  private onRangeChange(info: DatesSetInfo): void {
    this.visibleRangeLabel.set(
      `${info.view.title}${info.start && info.end ? ` · ${info.start.toLocaleDateString('es')} - ${info.end.toLocaleDateString('es')}` : ''}`
    );
  }

  private onDateSelect(info: DateSelectInfo): void {
    if (!this.auth.can('events', 'MANAGE')) {
      return;
    }

    void this.router.navigate(['/events/new'], {
      queryParams: { fecha: toDateValue(info.start) },
    });
  }
}

function toDateValue(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Suma dias a una fecha calendario "YYYY-MM-DD". */
function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
