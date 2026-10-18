import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * English UI copy straight from `public/i18n/en.json`, so e2e assertions on translated error text
 * (ADR-045: the UI never shows server prose) follow the translation file instead of duplicating
 * literals. Playwright runs from the Rental-Ui root.
 */
const en = JSON.parse(readFileSync(join(process.cwd(), 'public/i18n/en.json'), 'utf8')) as unknown;

export function enText(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
  if (typeof value !== 'string') throw new Error(`Missing en.json key: ${key}`);
  return value;
}
