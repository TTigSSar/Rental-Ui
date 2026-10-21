import { formatDate, registerLocaleData } from '@angular/common';
import localeHy from '@angular/common/locales/hy';
import localeRu from '@angular/common/locales/ru';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

/**
 * ADR-052: the only place that formats dates for display. Features must not call `DatePipe`,
 * `formatDate` or `toLocale*String` directly - they use the `uiDate` pipe, `UiDateService`, or
 * `formatUiDate` below, which follow the current UI language (ADR-038), not the browser's.
 */

// 'en' is built into Angular; ru and hy ship as separate locale data.
registerLocaleData(localeRu, 'ru');
registerLocaleData(localeHy, 'hy');

/** Maps our language codes to Angular locale ids (identity today; the seam if they diverge). */
const ANGULAR_LOCALE: Readonly<Record<string, string>> = { en: 'en', ru: 'ru', hy: 'hy' };

/** Yerevan has no DST; the offset is fixed at +04:00 (ADR-048). */
export const YEREVAN_UTC_OFFSET = '+0400';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export type UiDateValue = string | number | Date | null | undefined;

export interface UiDateOptions {
  /**
   * The value is a calendar day, not an instant: render it in its own (local) frame with no
   * Yerevan shift. Strings shaped `yyyy-MM-dd` (backend DateOnly) are detected automatically;
   * pass this for a `Date` built from local year/month/day (e.g. a date-picker selection).
   */
  readonly dateOnly?: boolean;
}

/** Angular locale id for a UI language code; unknown or empty codes fall back to English. */
export function uiLocaleId(lang: string | null | undefined): string {
  return ANGULAR_LOCALE[lang ?? ''] ?? 'en';
}

/**
 * Formats `value` with `pattern` in the language `lang`. Instants are shown in Yerevan time
 * (+04:00); date-only values are not shifted. Returns '' for empty or unparsable input.
 */
export function formatUiDate(
  value: UiDateValue,
  pattern: string,
  lang: string | null | undefined,
  options: UiDateOptions = {},
): string {
  if (value === null || value === undefined || value === '') return '';
  const dateOnly = options.dateOnly === true || (typeof value === 'string' && DATE_ONLY.test(value));
  try {
    return formatDate(value, pattern, uiLocaleId(lang), dateOnly ? undefined : YEREVAN_UTC_OFFSET);
  } catch {
    return '';
  }
}

/**
 * A date range with the day before the month and the year once, at the end:
 * en "17 Oct – 24 Oct, 2026", ru "17 окт. – 24 окт. 2026", hy "17 հոկ – 24 հոկ 2026".
 * With `withYear: false` the range stays yearless ("17 Oct – 24 Oct"). Both ends are
 * date-only by default (booking dates); pass `dateOnly: false` for instants.
 */
export function formatUiDateRange(
  start: UiDateValue,
  end: UiDateValue,
  lang: string | null | undefined,
  options: { withYear?: boolean; dateOnly?: boolean } = {},
): string {
  const dateOnly = options.dateOnly !== false;
  const endPattern = options.withYear === false ? 'd MMM' : uiLocaleId(lang) === 'en' ? 'd MMM, y' : 'd MMM y';
  const from = formatUiDate(start, 'd MMM', lang, { dateOnly });
  const to = formatUiDate(end, endPattern, lang, { dateOnly });
  if (!from) return to;
  if (!to) return from;
  return `${from} – ${to}`;
}

/**
 * Holds the current UI language as a signal (ngx-translate's `onLangChange`), so computeds and
 * impure pipes that format through it re-run when the language is switched.
 */
@Injectable({ providedIn: 'root' })
export class UiDateService {
  private readonly translate = inject(TranslateService);

  readonly lang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });

  /** Date range in the current UI language; see {@link formatUiDateRange}. */
  formatRange(
    start: UiDateValue,
    end: UiDateValue,
    options?: { withYear?: boolean; dateOnly?: boolean },
  ): string {
    return formatUiDateRange(start, end, this.lang(), options);
  }

  /** Formats in the current UI language; reading it inside `computed`/a template tracks the language. */
  format(value: UiDateValue, pattern: string, options?: UiDateOptions): string {
    return formatUiDate(value, pattern, this.lang(), options);
  }
}
