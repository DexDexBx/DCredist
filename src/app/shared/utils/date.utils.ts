const LOCALE = 'es';

const longDate = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const mediumDate = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const time = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });

export function formatLongDate(value: string | Date): string {
  const date = toDate(value);
  return date ? longDate.format(date) : '';
}

export function formatMediumDate(value: string | Date): string {
  const date = toDate(value);
  return date ? mediumDate.format(date) : '';
}

export function formatTime(value: string | Date): string {
  const date = toDate(value);
  return date ? time.format(date) : '';
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  const left = toDate(a);
  const right = toDate(b);
  if (!left || !right) {
    return false;
  }
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Horario del evento, por ejemplo "09:00 - 18:00". */
export function formatSchedule(start: string | Date, end: string | Date): string {
  const from = formatTime(start);
  const to = formatTime(end);
  if (!from || !to) {
    return '';
  }
  return `${from} - ${to}`;
}

/** Rango de fechas calendario, sin hora: "30 sept 2026" o "30 sept 2026 - 02 oct 2026". */
export function formatDateRange(start: string | Date, end: string | Date): string {
  const from = formatMediumDate(start);
  const to = formatMediumDate(end);
  if (!from || !to) {
    return '';
  }
  return isSameDay(start, end) ? from : `${from} - ${to}`;
}

/**
 * Interpreta una fecha calendario "YYYY-MM-DD" como dia local.
 *
 * `new Date('2026-10-05')` la interpreta como medianoche UTC y en Peru se veria
 * como el dia anterior. Las fechas de evento no tienen hora: se construyen con
 * los componentes locales para que el dia mostrado sea el guardado.
 */
export function parseCalendarDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Rango completo con hora (solo para marcas de tiempo como participationDate). */
export function formatDateTimeRange(start: string | Date, end: string | Date): string {
  const schedule = formatSchedule(start, end);
  if (isSameDay(start, end)) {
    return `${formatMediumDate(start)} · ${schedule}`;
  }
  return `${formatMediumDate(start)} ${formatTime(start)} - ${formatMediumDate(end)} ${formatTime(end)}`;
}

function toDate(value: string | Date): Date | null {
  return parseCalendarDate(value);
}
