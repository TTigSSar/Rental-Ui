import { Pipe, inject, type PipeTransform } from '@angular/core';

import { UiDateService, type UiDateOptions, type UiDateValue } from './ui-date';

/**
 * `{{ value | uiDate: 'MMM d' }}` - the single date pipe (ADR-052). Formats in the current UI
 * language and Yerevan time; `'yyyy-MM-dd'` strings are treated as date-only. Pass
 * `{ dateOnly: true }` for a local-calendar `Date`.
 *
 * Impure so a language switch re-renders it without a reload; the last result is cached by
 * (value, pattern, language, dateOnly), so a re-check with unchanged inputs does not re-format.
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
 *
 * Impure so a language switch re-renders it; the last result is cached by (start, end, withYear,
 * dateOnly, language), so a re-check with unchanged inputs does not re-format.
 */
@Pipe({ name: 'uiDateRange', standalone: true, pure: false })
export class UiDateRangePipe implements PipeTransform {
  private readonly dates = inject(UiDateService);

  private lastStart: UiDateValue;
  private lastEnd: UiDateValue;
  private lastStartTime: number | null = null;
  private lastEndTime: number | null = null;
  private lastWithYear: boolean | undefined;
  private lastDateOnly: boolean | undefined;
  private lastLang: string | undefined;
  private lastResult = '';
  private primed = false;

  transform(
    start: UiDateValue,
    end: UiDateValue,
    options?: { withYear?: boolean; dateOnly?: boolean },
  ): string {
    const lang = this.dates.lang();
    const startTime = start instanceof Date ? start.getTime() : null;
    const endTime = end instanceof Date ? end.getTime() : null;
    if (
      this.primed &&
      this.lastStart === start &&
      this.lastEnd === end &&
      this.lastStartTime === startTime &&
      this.lastEndTime === endTime &&
      this.lastWithYear === options?.withYear &&
      this.lastDateOnly === options?.dateOnly &&
      this.lastLang === lang
    ) {
      return this.lastResult;
    }
    this.primed = true;
    this.lastStart = start;
    this.lastEnd = end;
    this.lastStartTime = startTime;
    this.lastEndTime = endTime;
    this.lastWithYear = options?.withYear;
    this.lastDateOnly = options?.dateOnly;
    this.lastLang = lang;
    this.lastResult = this.dates.formatRange(start, end, options);
    return this.lastResult;
  }
}
