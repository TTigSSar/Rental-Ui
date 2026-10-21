import { Pipe, inject, type PipeTransform } from '@angular/core';

import { UiDateService, type UiDateOptions, type UiDateValue } from './ui-date';

/**
 * `{{ value | uiDate: 'MMM d' }}` - the single date pipe (ADR-052). Formats in the current UI
 * language and Yerevan time; `'yyyy-MM-dd'` strings are treated as date-only. Pass
 * `{ dateOnly: true }` for a local-calendar `Date`.
 *
 * Impure so a language switch re-renders it without a reload; the work is one `formatDate` call
 * and the last result is cached by (value, pattern, language, dateOnly), so re-checks are cheap.
 */
@Pipe({ name: 'uiDate', standalone: true, pure: false })
export class UiDatePipe implements PipeTransform {
  private readonly dates = inject(UiDateService);

  private lastValue: UiDateValue;
  private lastTime: number | null = null;
  private lastPattern = '';
  private lastLang: string | undefined;
  private lastDateOnly = false;
  private lastResult = '';
  private primed = false;

  transform(value: UiDateValue, pattern: string, options?: UiDateOptions): string {
    const lang = this.dates.lang();
    const time = value instanceof Date ? value.getTime() : null;
    const dateOnly = options?.dateOnly === true;
    if (
      this.primed &&
      this.lastValue === value &&
      this.lastTime === time &&
      this.lastPattern === pattern &&
      this.lastLang === lang &&
      this.lastDateOnly === dateOnly
    ) {
      return this.lastResult;
    }
    this.primed = true;
    this.lastValue = value;
    this.lastTime = time;
    this.lastPattern = pattern;
    this.lastLang = lang;
    this.lastDateOnly = dateOnly;
    this.lastResult = this.dates.format(value, pattern, options);
    return this.lastResult;
  }
}

/**
 * `{{ start | uiDateRange: end }}` - day-before-month range with the year once at the end;
 * `{ withYear: false }` keeps it yearless. Date-only by default (booking dates).
 */
@Pipe({ name: 'uiDateRange', standalone: true, pure: false })
export class UiDateRangePipe implements PipeTransform {
  private readonly dates = inject(UiDateService);

  transform(
    start: UiDateValue,
    end: UiDateValue,
    options?: { withYear?: boolean; dateOnly?: boolean },
  ): string {
    return this.dates.formatRange(start, end, options);
  }
}
