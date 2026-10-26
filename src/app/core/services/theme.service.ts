import { Injectable, computed, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dcredits-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /**
   * Tema vigente y si fue una eleccion explicita de la persona.
   *
   * La distincion importa: si el tema salio del sistema operativo se sigue al
   * sistema, pero en cuanto alguien pulsa el interruptor, manda esa eleccion.
   */
  private readonly themeState = signal<Theme>(this.readStoredTheme());
  private readonly chosenState = signal(this.hasStoredTheme());

  readonly theme = this.themeState.asReadonly();
  readonly isDark = computed(() => this.themeState() === 'dark');

  constructor() {
    this.applyTheme(this.themeState());

    if (typeof window.matchMedia === 'function') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (event) => {
          if (this.chosenState()) {
            return;
          }

          const theme: Theme = event.matches ? 'dark' : 'light';
          this.themeState.set(theme);
          this.applyTheme(theme);
        });
    }
  }

  toggleTheme(): void {
    this.setTheme(this.themeState() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: Theme): void {
    this.themeState.set(theme);
    this.chosenState.set(true);
    this.applyTheme(theme);
  }

  private hasStoredTheme(): boolean {
    const stored = this.readStorage();
    return stored === 'dark' || stored === 'light';
  }

  /**
   * Tema guardado, o el del sistema si la persona todavia no eligio ninguno.
   *
   * Sin esto, quien trabaja con el escritorio en oscuro abre el panel en claro y
   * tiene que cambiarlo a mano.
   */
  private readStoredTheme(): Theme {
    const stored = this.readStorage();

    if (stored === 'dark' || stored === 'light') {
      return stored;
    }

    return this.prefersDark() ? 'dark' : 'light';
  }

  private readStorage(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem(STORAGE_KEY);
  }

  private prefersDark(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  }

  /**
   * Pinta el tema en el documento.
   *
   * Solo guarda cuando hay eleccion explicita: si se guardara el tema heredado del
   * sistema, la primera carga convertiria esa preferencia en permanente.
   */
  private applyTheme(theme: Theme): void {
    if (this.chosenState() && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }

    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.setAttribute('data-color-scheme', theme);
  }
}