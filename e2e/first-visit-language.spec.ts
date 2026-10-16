import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';

/**
 * First visit language (ADR-038). Mocked tier: a fresh context (no `stayfinder.lang`) takes the
 * UI language from the browser locale - hy or ru when preferred, otherwise English - and the
 * detected language is NOT written to localStorage (only an explicit choice is stored).
 */
const STORAGE_KEY = 'stayfinder.lang';

async function openHome(page: import('@playwright/test').Page): Promise<void> {
  await mockTiles(page);
  await mockApi(page, {});
  await page.goto('/');
}

test.describe('first-visit language (ADR-038)', () => {
  test.describe('Armenian browser', () => {
    test.use({ locale: 'hy-AM' });

    test('lands in Armenian without storing the choice', async ({ page }) => {
      await openHome(page);

      await expect(page.locator('html')).toHaveAttribute('lang', 'hy');
      await expect(page.getByRole('button', { name: 'Մուտք' })).toBeVisible();
      expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
    });
  });

  test.describe('Russian browser', () => {
    test.use({ locale: 'ru-RU' });

    test('lands in Russian without storing the choice', async ({ page }) => {
      await openHome(page);

      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
      await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
      expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
    });
  });

  test.describe('English browser', () => {
    test.use({ locale: 'en-US' });

    test('stays in English without storing the choice', async ({ page }) => {
      await openHome(page);

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
      expect(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY)).toBeNull();
    });
  });
});
