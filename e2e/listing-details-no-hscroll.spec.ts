import { expect, test } from '@playwright/test';

import { e2eListingDetails } from './support/fixtures';
import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';

/**
 * Regression (ADR-063, M-026): the listing-details hero bled by a hard-coded 10px while the
 * <=560px page gutter is 8px, so the page scrolled sideways by 2px on phones, and between
 * 561-1099px the hero left side strips instead of bleeding. The hero must read --page-gutter.
 * jsdom has no layout engine, so only a real browser can prove it.
 */
const OVERFLOW_WIDTHS: Array<[number, number]> = [
  [320, 700],
  [375, 812],
  [414, 896],
];

async function openDetails(page: import('@playwright/test').Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await mockTiles(page);
  await mockApi(page, { listingDetails: e2eListingDetails() });
  await page.goto('/listings/listing-e2e-1');
  await expect(page.locator('.detail-page__hero')).toBeVisible();
  await page.addStyleTag({
    content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
  });
}

for (const [width, height] of OVERFLOW_WIDTHS) {
  test(`listing details has no horizontal scroll at ${width}px`, async ({ page }) => {
    await openDetails(page, width, height);
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(m.scrollWidth, 'documentElement.scrollWidth <= window.innerWidth').toBeLessThanOrEqual(m.innerWidth);
  });
}

for (const [width, height] of [
  [375, 812],
  [768, 1024],
] as Array<[number, number]>) {
  test(`listing details hero bleeds edge to edge at ${width}px`, async ({ page }) => {
    await openDetails(page, width, height);
    const box = await page.evaluate(() => {
      const r = document.querySelector('.detail-page__hero')!.getBoundingClientRect();
      return { left: r.left, right: r.right, viewport: window.innerWidth };
    });
    expect(Math.abs(box.left), 'hero left edge at 0').toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.right - box.viewport), 'hero right edge at innerWidth').toBeLessThanOrEqual(0.5);
  });
}
