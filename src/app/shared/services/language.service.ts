import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';

import { PrimeNG } from 'primeng/config';

import * as AuthActions from '../../features/auth/store/auth.actions';

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

/**
 * The browser's preferred languages, in preference order (ADR-038). The default reads
 * `navigator` safely; specs provide their own value.
 */
export const BROWSER_LANGUAGES = new InjectionToken<readonly string[]>('BROWSER_LANGUAGES', {
  providedIn: 'root',
  factory: () => {
    if (typeof navigator === 'undefined') return [];
    if (navigator.languages && navigator.languages.length > 0) return [...navigator.languages];
    return navigator.language ? [navigator.language] : [];
  },
});

const CALENDAR_KEYS = [
  ['monthNames', 12],
  ['monthNamesShort', 12],
  ['dayNames', 7],
  ['dayNamesShort', 7],
  ['dayNamesMin', 7],
] as const;

/**
 * The `calendar` block of a loaded translation file (ADR-033), or null when it is missing or
 * malformed (wrong shape or array length), so a bad file never breaks the DatePicker.
 */
function calendarFrom(translations: unknown): Record<string, string[]> | null {
  const calendar = (translations as { calendar?: unknown } | null | undefined)?.calendar;
  if (typeof calendar !== 'object' || calendar === null) return null;
  const result: Record<string, string[]> = {};
  for (const [key, length] of CALENDAR_KEYS) {
    const value = (calendar as Record<string, unknown>)[key];
    if (
      !Array.isArray(value) ||
      value.length !== length ||
      !value.every((s) => typeof s === 'string')
    ) {
      return null;
    }
    result[key] = value as string[];
  }
  return result;
}

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
  private readonly store = inject(Store);
  private readonly document = inject(DOCUMENT);
  private readonly primeng = inject(PrimeNG);
  private readonly browserLanguages = inject(BROWSER_LANGUAGES);

  readonly languages: readonly LanguageOption[] = LANGUAGES;

  /** The active language. Resolved from storage at construction time. */
  readonly current = signal<LanguageOption>(this.resolveInitial());

  constructor() {
    // Translations load over HTTP, so PrimeNG's calendar strings (ADR-033) are pushed when a
    // language's file has arrived (this also covers the first hydrate), not in `use()`.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe((event) => this.pushCalendar(event.translations));
  }

  /** Applies the resolved language to ngx-translate. Call once, on app boot. */
  hydrate(): void {
    this.translate.use(this.current().code);
    this.setDocumentLang(this.current().code);
  }

  /**
   * Inbound path: applies the language a signed-in user has saved on the
   * server (called from `AuthEffects` on `loadCurrentUserSuccess`, i.e. app
   * boot with a token and post-login/register/external-auth).
   *
   * No-ops when `code` is null/undefined/unknown — a user with no saved
   * preference keeps whatever is already active (localStorage/default).
   * Never persists back to the backend; only the outbound `use()` does that,
   * so applying a server value can never trigger a re-persist loop.
   */
  applyFromUser(code: string | null | undefined): void {
    if (code === null || code === undefined) return;
    const option = this.languages.find((l) => l.code === code);
    if (option === undefined) return;
    this.applyLocally(option);
  }

  /**
   * Outbound path: user-initiated language switch. Updates state, ngx-translate,
   * and localStorage, then dispatches `AuthActions.updatePreferredLanguage` so
   * `AuthEffects` can persist it to the backend when the user is authenticated
   * (a no-op while signed out — localStorage-only, same as before).
   */
  use(code: LanguageCode): void {
    const option = this.languages.find((l) => l.code === code) ?? this.languages[0];
    this.applyLocally(option);
    this.store.dispatch(AuthActions.updatePreferredLanguage({ code: option.code }));
  }

  private applyLocally(option: LanguageOption): void {
    this.current.set(option);
    this.translate.use(option.code);
    this.setDocumentLang(option.code);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code);
    } catch {
      /* ignore (private browsing / storage disabled) */
    }
  }

  /** Keeps `<html lang>` in step with the UI language (screen readers, hyphenation, spellcheck). */
  private setDocumentLang(code: LanguageCode): void {
    this.document.documentElement.lang = code;
  }

  /**
   * Pushes the language's DatePicker month/day names to PrimeNG. `chooseMonth`/`chooseYear` stay
   * empty so the buttons are named by their visible text. A missing or malformed `calendar`
   * block skips the push (PrimeNG keeps its previous strings) and never throws.
   */
  private pushCalendar(translations: unknown): void {
    const calendar = calendarFrom(translations);
    if (calendar === null) return;
    this.primeng.setTranslation({ ...calendar, chooseMonth: '', chooseYear: '' });
  }

  private resolveInitial(): LanguageOption {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const storedOption = this.languages.find((l) => l.code === stored);
    if (storedOption !== undefined) return storedOption;
    // ADR-038: no explicit choice yet - follow the browser; deliberately not persisted.
    for (const tag of this.browserLanguages) {
      const primary = String(tag).split(/[-_]/)[0].toLowerCase();
      const match = this.languages.find((l) => l.code === primary);
      if (match !== undefined) return match;
    }
    return this.languages[0];
  }
}
