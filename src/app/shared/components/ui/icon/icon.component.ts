import { Component, computed, input } from '@angular/core';

export type IconName =
  | 'dashboard'
  | 'calendar'
  | 'event'
  | 'users'
  | 'user-plus'
  | 'shield-check'
  | 'menu'
  | 'close'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'chevron-down'
  | 'chevron-right'
  | 'plus'
  | 'search'
  | 'arrow-left'
  | 'clock'
  | 'map-pin'
  | 'check'
  | 'info'
  | 'building'
  | 'mail'
  | 'phone'
  | 'document'
  | 'graduation'
  | 'trending-up'
  | 'download'
  | 'key'
  | 'copy'
  | 'refresh'
  | 'settings'
  | 'pencil'
  | 'logout';

interface IconDefinition {
  paths: string[];
  /** Algunos iconos se dibujan solo con trazo, otros requieren relleno. */
  filled?: boolean;
}

const ICONS: Record<IconName, IconDefinition> = {
  dashboard: {
    paths: [
      'M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4Z',
      'M13 5.5A1.5 1.5 0 0 1 14.5 4h4A1.5 1.5 0 0 1 20 5.5v4A1.5 1.5 0 0 1 18.5 11h-4A1.5 1.5 0 0 1 13 9.5v-4Z',
      'M4 14.5A1.5 1.5 0 0 1 5.5 13h4A1.5 1.5 0 0 1 11 14.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4Z',
      'M13 14.5A1.5 1.5 0 0 1 14.5 13h4A1.5 1.5 0 0 1 20 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4Z',
    ],
  },
  calendar: {
    paths: [
      'M6.75 4.75h10.5A1.75 1.75 0 0 1 19 6.5v12a1.75 1.75 0 0 1-1.75 1.75H6.75A1.75 1.75 0 0 1 5 18.5v-12a1.75 1.75 0 0 1 1.75-1.75Z',
      'M8.75 3v3.5M15.25 3v3.5M5 10h14',
    ],
  },
  event: {
    paths: [
      'M4.75 7.5h14.5a1 1 0 0 1 1 1v9.75a1.75 1.75 0 0 1-1.75 1.75H5.5a1.75 1.75 0 0 1-1.75-1.75V8.5a1 1 0 0 1 1-1Z',
      'M8 7.5V6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1.5',
      'M8.5 12.5h7M8.5 16h4',
    ],
  },
  users: {
    paths: [
      'M9.5 11.75a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      'M3.5 19.75c0-3.038 2.687-5.5 6-5.5s6 2.462 6 5.5',
      'M16.5 5.25a3.25 3.25 0 0 1 0 6.2',
      'M17.75 14.5c1.85.8 2.75 2.5 2.75 4.75',
    ],
  },
  'user-plus': {
    paths: [
      'M9.5 11a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z',
      'M3.75 19.5c0-2.9 2.57-5.25 5.75-5.25 1.2 0 2.32.3 3.24.83',
      'M18 14.5v5M15.5 17h5',
    ],
  },
  'shield-check': {
    paths: [
      'M12 3.75 5.5 6v5.25c0 3.75 2.6 7.25 6.5 8.25 3.9-1 6.5-4.5 6.5-8.25V6L12 3.75Z',
      'm9.25 11.75 2 2 3.5-3.75',
    ],
  },
  menu: {
    paths: ['M4 7h16M4 12h16M4 17h16'],
  },
  close: {
    paths: ['M6 6l12 12M18 6 6 18'],
  },
  bell: {
    paths: [
      'M18 9.25a6 6 0 1 0-12 0c0 5-2 6.75-2 6.75h16s-2-1.75-2-6.75Z',
      'M13.75 19.25a2 2 0 0 1-3.5 0',
    ],
  },
  sun: {
    paths: [
      'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z',
      'M12 2.75v2M12 19.25v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.75 12h2M19.25 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4',
    ],
  },
  moon: {
    paths: ['M20.25 14.25A8.25 8.25 0 0 1 9.75 3.75a8.25 8.25 0 1 0 10.5 10.5Z'],
  },
  'chevron-down': {
    paths: ['m6 9.5 6 6 6-6'],
  },
  'chevron-right': {
    paths: ['m9.5 6 6 6-6 6'],
  },
  plus: {
    paths: ['M12 5v14M5 12h14'],
  },
  search: {
    paths: ['M10.75 18a7.25 7.25 0 1 0 0-14.5 7.25 7.25 0 0 0 0 14.5Z', 'm20.5 20.5-4.25-4.25'],
  },
  'arrow-left': {
    paths: ['M19 12H5M11 6l-6 6 6 6'],
  },
  clock: {
    paths: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.5V12l3.25 2'],
  },
  'map-pin': {
    paths: [
      'M12 21s6.75-5.5 6.75-10.5a6.75 6.75 0 1 0-13.5 0C5.25 15.5 12 21 12 21Z',
      'M12 13.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z',
    ],
  },
  check: {
    paths: ['m5 12.5 4.5 4.5L19 7'],
  },
  info: {
    paths: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
      'M12 11v5.5M12 7.75h.01',
    ],
  },
  building: {
    paths: [
      'M4.75 20.25V5.75A1.75 1.75 0 0 1 6.5 4h7A1.75 1.75 0 0 1 15.25 5.75v14.5',
      'M15.25 20.25V9.5h2.5A1.75 1.75 0 0 1 19.5 11.25v9',
      'M3 20.25h18M8.5 8h3.25M8.5 12h3.25M8.5 16h3.25',
    ],
  },
  mail: {
    paths: [
      'M4.5 6.75h15a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 15.75v-7.5a1.5 1.5 0 0 1 1.5-1.5Z',
      'm3.75 8 7.36 5.13a1.5 1.5 0 0 0 1.78 0L20.25 8',
    ],
  },
  phone: {
    paths: [
      'M8.25 4.5h-2A2.25 2.25 0 0 0 4 6.75C4 14.5 9.5 20 17.25 20a2.25 2.25 0 0 0 2.25-2.25v-2l-4-1.25-1.5 2a13.5 13.5 0 0 1-7.25-7.25l2-1.5-1.25-4Z',
    ],
  },
  document: {
    paths: [
      'M6.75 3.75h7.5L18.75 8v11.25a1.5 1.5 0 0 1-1.5 1.5h-10.5a1.5 1.5 0 0 1-1.5-1.5V5.25a1.5 1.5 0 0 1 1.5-1.5Z',
      'M14 3.75V8h4.5M8.75 13h6.5M8.75 16.5h4.5',
    ],
  },
  graduation: {
    paths: [
      'M3.75 9.25 12 5.5l8.25 3.75L12 13 3.75 9.25Z',
      'M7 11v4.25c0 1.5 2.239 2.75 5 2.75s5-1.25 5-2.75V11',
      'M20.25 9.25v5.5',
    ],
  },
  'trending-up': {
    paths: [
      'M4.75 16.75 9.5 12l3.5 3.5 6.25-6.25',
      'M14.75 9.25h4.5v4.5',
    ],
  },
  download: {
    paths: [
      'M12 4.25v10.5',
      'm7.75 10.5 4.25 4.25 4.25-4.25',
      'M4.75 19.25h14.5',
    ],
  },
  key: {
    paths: [
      'M15.75 4.75a4.75 4.75 0 1 0-4.5 6.2l-.05.05H4.75v3.5h3.5v3.5h3.5l1.75-1.75v-2.6a4.75 4.75 0 0 0 2.25-8.9Z',
      'M16.5 8.5h.01',
    ],
  },
  copy: {
    paths: [
      'M9.75 9.75h8A1.5 1.5 0 0 1 19.25 11.25v8A1.5 1.5 0 0 1 17.75 20.75h-8A1.5 1.5 0 0 1 8.25 19.25v-8A1.5 1.5 0 0 1 9.75 9.75Z',
      'M6.25 14.75h-.5A1.5 1.5 0 0 1 4.25 13.25v-8A1.5 1.5 0 0 1 5.75 3.75h8a1.5 1.5 0 0 1 1.5 1.5v.5',
    ],
  },
  refresh: {
    paths: [
      'M19.25 12a7.25 7.25 0 1 1-2.4-5.36',
      'M19.75 4.75v4.5h-4.5',
    ],
  },
  settings: {
    paths: [
      'M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z',
      'M19.25 13.5a7.6 7.6 0 0 0 0-3l1.6-1.2-2-3.4-1.85.75a7.6 7.6 0 0 0-2.6-1.5L14 3.4h-4l-.4 1.75a7.6 7.6 0 0 0-2.6 1.5L5.15 5.9l-2 3.4L4.75 10.5a7.6 7.6 0 0 0 0 3l-1.6 1.2 2 3.4 1.85-.75a7.6 7.6 0 0 0 2.6 1.5L10 20.6h4l.4-1.75a7.6 7.6 0 0 0 2.6-1.5l1.85.75 2-3.4-1.6-1.2Z',
    ],
  },
  pencil: {
    paths: [
      'M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3Z',
      'M14.5 6.5l3 3',
    ],
  },
  logout: {
    paths: [
      'M10 4.75H6.5A1.75 1.75 0 0 0 4.75 6.5v11a1.75 1.75 0 0 0 1.75 1.75H10',
      'M15.5 8.5 19 12l-3.5 3.5M19 12H9.5',
    ],
  },
};

@Component({
  selector: 'dc-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      @for (path of definition().paths; track path) {
      <path
        [attr.d]="path"
        [attr.stroke]="definition().filled ? 'none' : 'currentColor'"
        [attr.fill]="definition().filled ? 'currentColor' : 'none'"
        [attr.stroke-width]="strokeWidth()"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      }
    </svg>
  `,
  host: { class: 'inline-flex shrink-0 items-center justify-center' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.7);

  readonly definition = computed<IconDefinition>(() => ICONS[this.name()]);
}
