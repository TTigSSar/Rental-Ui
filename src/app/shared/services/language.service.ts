import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type LanguageCode = 'en' | 'hy' | 'ru';

export interface LanguageOption {
  readonly code: LanguageCode;
  readonly flag: string;
  /** Name written in the language's own script (e.g. "Հայերեն"). */
  readonly native: string;
  /** English name of the language (e.g. "Armenian"). */
  readonly label: string;
}

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';

const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', flag: '🇬🇧', native: 'English', label: 'English' },
  { code: 'hy', flag: '🇦🇲', native: 'Հայերեն', label: 'Armenian' },
  { code: 'ru', flag: '🇷🇺', native: 'Русский', label: 'Russian' },
];

/**
 * Single source of truth for the app's current display language.
 *
 * Owns the `localStorage` persistence and the `TranslateService.use()` call
 * that used to be duplicated between the app shell (guest-facing hydration on
 * boot) and the profile page (the only place a signed-in user could change
 * language). Both now delegate here; a third, guest-facing entry point (the
 * header dropdown / mobile sheet) reads and writes through the same service.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly languages: readonly LanguageOption[] = LANGUAGES;

  /** The active language. Resolved from storage at construction time. */
  readonly current = signal<LanguageOption>(this.resolveInitial());

  /** Applies the resolved language to ngx-translate. Call once, on app boot. */
  hydrate(): void {
    this.translate.use(this.current().code);
  }

  /** Switches the active language: updates state, ngx-translate, and storage. */
  use(code: LanguageCode): void {
    const option = this.languages.find((l) => l.code === code) ?? this.languages[0];
    this.current.set(option);
    this.translate.use(option.code);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code);
    } catch {
      /* ignore (private browsing / storage disabled) */
    }
  }

  private resolveInitial(): LanguageOption {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return this.languages.find((l) => l.code === stored) ?? this.languages[0];
  }
}
