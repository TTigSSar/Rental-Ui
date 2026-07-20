import { formatNumber } from '@angular/common';
import { Pipe, type PipeTransform } from '@angular/core';

/** Dram has no practical minor unit — nobody prices a rental at 2500.50 ֏. */
const DRAM_DIGITS_INFO = '1.0-0';

/**
 * Formats an amount as Armenian dram: thousands-grouped whole number followed
 * by the ֏ symbol, e.g. `2500 | dram` -> "2,500 ֏".
 *
 * DoRent is single-currency (AMD) app-wide, so this pipe — not Angular's
 * built-in `currency` pipe — is the one formatting call every price render
 * site should use. Two reasons `currency` doesn't fit here:
 *  - Angular's bundled 'en' locale data has no symbol entry for AMD, so
 *    `{{ x | currency:'AMD' }}` renders the literal code ("AMD2,500"), not ֏.
 *  - The CLDR pattern that *does* know ֏ (the `hy` locale) places the symbol
 *    after the amount using a non-breaking-space thousands separator
 *    ("2 500 ֏"), which reads inconsistently next to the comma-grouped
 *    numbers used everywhere else in this app (ratings, counts, ages, …).
 * Formatting the number with the app's existing 'en-US' grouping and
 * appending the symbol as a literal suffix keeps the Armenian convention
 * (symbol after the amount) while staying visually consistent with the rest
 * of the UI.
 */
@Pipe({ name: 'dram', standalone: true })
export class DramCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(num)) {
      return null;
    }
    return `${formatNumber(num, 'en-US', DRAM_DIGITS_INFO)} ֏`;
  }
}
