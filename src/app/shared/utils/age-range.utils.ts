import { uiLocaleId } from './ui-date';

/**
 * ADR-068: the toy age range is stored and sent in months but displayed in years from 12 months
 * (months only below one year). This is the single formatter for every display of it.
 */

export type AgeUnit = 'month' | 'year';

export interface AgeBound {
  readonly unit: AgeUnit;
  /** Whole months below 12 months; years in half-year steps from 12 months. */
  readonly value: number;
}

export type AgeRange =
  | { readonly kind: 'fromTo'; readonly from: AgeBound; readonly to: AgeBound }
  | { readonly kind: 'fromOnly'; readonly from: AgeBound }
  | { readonly kind: 'toOnly'; readonly to: AgeBound };

/** Translate lookup (e.g. `TranslateService.instant`); returns the key itself when missing. */
export type AgeTranslate = (key: string, params?: Record<string, unknown>) => string;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** A bound below 12 months stays in months; otherwise years rounded to the nearest half year. */
export function toAgeBound(months: number): AgeBound {
  if (months < 12) return { unit: 'month', value: Math.max(0, Math.round(months)) };
  return { unit: 'year', value: Math.round((months / 12) * 2) / 2 };
}

/** Pure structure of the range; `null` when neither bound is a finite number. */
export function resolveAgeRange(
  fromMonths: number | null | undefined,
  toMonths: number | null | undefined,
): AgeRange | null {
  // A lower bound of 0 means "no lower limit": it is dropped (ADR-068 amendment).
  const hasFrom = isFiniteNumber(fromMonths) && fromMonths > 0;
  const hasTo = isFiniteNumber(toMonths);
  if (hasFrom && hasTo) {
    return { kind: 'fromTo', from: toAgeBound(fromMonths), to: toAgeBound(toMonths) };
  }
  if (hasFrom) return { kind: 'fromOnly', from: toAgeBound(fromMonths) };
  if (hasTo) return { kind: 'toOnly', to: toAgeBound(toMonths) };
  return null;
}

function unitWord(bound: AgeBound, form: 'plain' | 'from' | 'to', lang: string, t: AgeTranslate): string {
  const category = new Intl.PluralRules(uiLocaleId(lang)).select(bound.value);
  const base = `listings.ageRange.unit.${bound.unit}`;
  return t(`${base}.${form}.${category}`);
}

/** The decimal separator is always a dot, in every locale (ADR-068 amendment). */
function numberText(bound: AgeBound): string {
  return String(bound.value);
}

function boundText(
  bound: AgeBound,
  form: 'plain' | 'from' | 'to',
  lang: string,
  t: AgeTranslate,
): string {
  return `${numberText(bound)} ${unitWord(bound, form, lang, t)}`;
}

/** Renders the range in `lang`, e.g. "6 months – 3 years", "1.5–5 years", "From 2 years". */
export function formatAgeRange(
  fromMonths: number | null | undefined,
  toMonths: number | null | undefined,
  lang: string,
  t: AgeTranslate,
): string {
  const range = resolveAgeRange(fromMonths, toMonths);
  if (!range) return '';
  switch (range.kind) {
    case 'fromTo':
      return range.from.unit === range.to.unit
        ? `${numberText(range.from)}–${boundText(range.to, 'plain', lang, t)}`
        : `${boundText(range.from, 'plain', lang, t)} – ${boundText(range.to, 'plain', lang, t)}`;
    case 'fromOnly':
      return t('listings.ageRange.fromOnly', { bound: boundText(range.from, 'from', lang, t) });
    case 'toOnly':
      return t('listings.ageRange.toOnly', { bound: boundText(range.to, 'to', lang, t) });
  }
}
