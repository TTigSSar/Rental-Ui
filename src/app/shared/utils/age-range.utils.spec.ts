import en from '../../../../public/i18n/en.json';
import hy from '../../../../public/i18n/hy.json';
import ru from '../../../../public/i18n/ru.json';

import { formatAgeRange, resolveAgeRange, toAgeBound, type AgeTranslate } from './age-range.utils';

function leaves(
  node: unknown,
  prefix = '',
  out: Record<string, string> = {},
): Record<string, string> {
  if (node !== null && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      leaves(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out[prefix] = String(node);
  }
  return out;
}

/** The real bundles, so the spec also guards the shipped keys. */
const DICT: Record<string, Record<string, string>> = {
  en: leaves(en),
  ru: leaves(ru),
  hy: leaves(hy),
};

function translator(lang: string): AgeTranslate {
  return (key, params) => {
    const template = DICT[lang][key];
    if (template === undefined) return key;
    return template.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(params?.[name]));
  };
}

function fmt(from: number | null, to: number | null, lang = 'en'): string {
  return formatAgeRange(from, to, lang, translator(lang));
}

describe('toAgeBound', () => {
  it('keeps months below 12 and converts to half-year steps from 12', () => {
    expect(toAgeBound(0)).toEqual({ unit: 'month', value: 0 });
    expect(toAgeBound(6)).toEqual({ unit: 'month', value: 6 });
    expect(toAgeBound(11)).toEqual({ unit: 'month', value: 11 });
    expect(toAgeBound(12)).toEqual({ unit: 'year', value: 1 });
    expect(toAgeBound(18)).toEqual({ unit: 'year', value: 1.5 });
    expect(toAgeBound(30)).toEqual({ unit: 'year', value: 2.5 });
    expect(toAgeBound(36)).toEqual({ unit: 'year', value: 3 });
    expect(toAgeBound(120)).toEqual({ unit: 'year', value: 10 });
  });

  it('rounds other values to the nearest half year', () => {
    expect(toAgeBound(14)).toEqual({ unit: 'year', value: 1 });
    expect(toAgeBound(16)).toEqual({ unit: 'year', value: 1.5 });
    expect(toAgeBound(33)).toEqual({ unit: 'year', value: 3 });
  });
});

describe('resolveAgeRange', () => {
  it('is null without a finite bound', () => {
    expect(resolveAgeRange(null, null)).toBeNull();
    expect(resolveAgeRange(undefined, Number.NaN)).toBeNull();
  });
});

describe('formatAgeRange (en)', () => {
  it('formats both bounds', () => {
    expect(fmt(6, 36)).toBe('6 months – 3 years');
    expect(fmt(12, 36)).toBe('1–3 years');
    expect(fmt(18, 60)).toBe('1.5–5 years');
    expect(fmt(0, 6)).toBe('0–6 months');
    expect(fmt(6, 11)).toBe('6–11 months');
  });

  it('formats from-only and to-only', () => {
    expect(fmt(24, null)).toBe('From 2 years');
    expect(fmt(null, 120)).toBe('Up to 10 years');
    expect(fmt(6, null)).toBe('From 6 months');
    expect(fmt(30, null)).toBe('From 2.5 years');
  });

  it('uses the singular for one', () => {
    expect(fmt(12, null)).toBe('From 1 year');
  });

  it('returns nothing when both bounds are missing', () => {
    expect(fmt(null, null)).toBe('');
  });
});

describe('formatAgeRange (ru)', () => {
  it('uses the right plural forms', () => {
    expect(fmt(null, 12, 'ru')).toBe('до 1 года');
    expect(fmt(12, 12, 'ru')).toBe('1–1 год');
    expect(fmt(12, 24, 'ru')).toBe('1–2 года');
    expect(fmt(12, 60, 'ru')).toBe('1–5 лет');
    expect(fmt(6, 36, 'ru')).toBe('6 мес. – 3 года');
  });

  it('uses a decimal comma and the genitive singular for half years', () => {
    expect(fmt(12, 18, 'ru')).toBe('1–1,5 года');
    expect(fmt(18, 60, 'ru')).toBe('1,5–5 лет');
    expect(fmt(null, 18, 'ru')).toBe('до 1,5 года');
  });

  it('uses the genitive after от / до', () => {
    expect(fmt(24, null, 'ru')).toBe('от 2 лет');
    expect(fmt(null, 120, 'ru')).toBe('до 10 лет');
    expect(fmt(12, null, 'ru')).toBe('от 1 года');
  });
});

describe('formatAgeRange (hy)', () => {
  it('formats with the locale decimal separator', () => {
    expect(fmt(18, 60, 'hy')).toBe('1,5–5 տարի');
    expect(fmt(6, 36, 'hy')).toBe('6 ամիս – 3 տարի');
    expect(fmt(24, null, 'hy')).toBe('Սկսած 2 տարի');
  });
});
