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

/** Rango completo: "30 sept 2026 · 09:00 - 18:00" o con dos fechas si son distintos dias. */
export function formatDateTimeRange(start: string | Date, end: string | Date): string {
  const schedule = formatSchedule(start, end);
  if (isSameDay(start, end)) {
    return `${formatMediumDate(start)} · ${schedule}`;
  }
  return `${formatMediumDate(start)} ${formatTime(start)} - ${formatMediumDate(end)} ${formatTime(end)}`;
}

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
