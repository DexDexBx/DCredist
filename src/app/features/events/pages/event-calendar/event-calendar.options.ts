import type {
  CalendarOptions,
  DateSelectInfo,
  DatesSetInfo,
  DayCellInfo,
  DayHeaderInfo,
  EventClickInfo,
  EventDisplayInfo,
  EventInput,
  ToolbarSectionInfo,
} from 'fullcalendar';
import dayGridPlugin from 'fullcalendar/daygrid';
import interactionPlugin from 'fullcalendar/interaction';
import multiMonthPlugin from 'fullcalendar/multimonth';
import themePlugin from 'fullcalendar/themes/classic';
import timeGridPlugin from 'fullcalendar/timegrid';
import { readExtendedText, escapeHtml } from '../../../../shared/utils/text.utils';
import { formatTime } from '../../../../shared/utils/date.utils';

export interface EventCalendarConfig {
  events: EventInput[];
  onEventClick: (info: EventClickInfo) => void;
  onRangeChange: (info: DatesSetInfo) => void;
  onDateSelect: (info: DateSelectInfo) => void;
}

export const CALENDAR_VIEW_OPTIONS: { key: string; label: string }[] = [
  { key: 'dayGridMonth', label: 'Mes' },
  { key: 'timeGridWeek', label: 'Semana' },
  { key: 'timeGridDay', label: 'Día' },
  { key: 'multiMonthYear', label: 'Año' },
];

/**
 * Construye las opciones de FullCalendar con la identidad visual de DCredits.
 * Vive fuera del componente para separar presentacion, logica y datos.
 */
export function buildCalendarOptions(config: EventCalendarConfig): CalendarOptions {
  return {
    plugins: [dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin, themePlugin],
    initialView: 'dayGridMonth',
    locale: 'es',
    firstDay: 1,
    height: 'auto',
    nowIndicator: true,
    selectable: true,
    editable: false,
    dayMaxEvents: 3,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dcViews',
    },
    views: {
      dcViews: {
        type: 'buttonGroup',
        buttons: {
          today: { text: 'Hoy' },
          month: { text: 'Mes' },
          week: { text: 'Semana' },
          day: { text: 'Día' },
          year: { text: 'Año' },
        },
      },
    },
    events: config.events,
    eventClick: config.onEventClick,
    datesSet: config.onRangeChange,
    select: config.onDateSelect,
    eventContent: renderEventContent,
    eventClass: () => 'dc-cal-event',
    dayHeaderClass: (info: DayHeaderInfo) => dayHeaderClasses(info),
    dayCellClass: (info: DayCellInfo) => dayCellClasses(info),
    toolbarSectionClass: (info: ToolbarSectionInfo) => toolbarSectionClasses(info),
  };
}

function renderEventContent(info: EventDisplayInfo): { html: string } {
  const props = info.event.extendedProps as Record<string, unknown>;
  const modality = readExtendedText(props, 'modality');
  const timeLabel = info.timeText || formatTime(info.event.start?.toISOString() ?? '');

  const meta = modality ? `${escapeHtml(timeLabel)} · ${escapeHtml(modality)}` : escapeHtml(timeLabel);

  return {
    html: `
      <span class="dc-cal-event__dot" style="background-color: ${info.color}"></span>
      <span class="dc-cal-event__body">
        <span class="dc-cal-event__title">${escapeHtml(info.event.title)}</span>
        <span class="dc-cal-event__meta">${meta}</span>
      </span>
    `,
  };
}

function dayHeaderClasses(info: DayHeaderInfo): string {
  return info.inPopover ? 'dc-cal-day-header dc-cal-day-header-popover' : 'dc-cal-day-header';
}

function dayCellClasses(info: DayCellInfo): string {
  return info.isToday ? 'dc-cal-day-cell dc-cal-day-cell-today' : 'dc-cal-day-cell';
}

function toolbarSectionClasses(info: ToolbarSectionInfo): string {
  return info.name === 'center' ? 'dc-cal-title' : 'dc-cal-toolbar-section';
}
