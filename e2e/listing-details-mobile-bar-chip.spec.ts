import { expect, test } from '@playwright/test';

import { e2eListingDetails } from './support/fixtures';
import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';

/**
 * Regression (commit 4cf6452): on listing details at <=1099px the "approximate area" chip
 * (`.listing-location__chip`, z-index 1002 leaked into the root stacking context because the map
 * card had none) painted OVER the fixed mobile bottom bar and covered the price. jsdom has no
 * layout/stacking engine, so only a real browser can prove it: with the chip scrolled to the bar's
 * vertical middle, `elementFromPoint` at the price and CTA centres must land inside the bar.
 * Red on the parent of 4cf6452 (price centre hit the chip), green with `isolation: isolate`.
 */
test.use({ locale: 'hy-AM' });

for (const [width, height] of [
  [375, 667],
  [430, 932],
]) {
  test(`mobile bar stays above the location chip at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockTiles(page);
    await mockApi(page, { listingDetails: e2eListingDetails() });
    await page.goto('/listings/listing-e2e-1');
    const chip = page.locator('.listing-location__chip');
    await expect(chip).toBeVisible();
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
    });

    // Put the chip's centre at the bar's vertical middle so the two overlap.
    await page.evaluate(() => {
      const bar = document.querySelector('.detail-page__mobile-bar')!.getBoundingClientRect();
      const c = document.querySelector('.listing-location__chip')!.getBoundingClientRect();
      window.scrollBy(0, c.top + c.height / 2 - (bar.top + bar.height / 2));
    });

    const hits = await page.evaluate(() => {
      const bar = document.querySelector('.detail-page__mobile-bar')!;
      const chipEl = document.querySelector('.listing-location__chip')!.getBoundingClientRect();
      const bb = bar.getBoundingClientRect();
      const hit = (sel: string) => {
        const b = document.querySelector(sel)!.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!top && bar.contains(top);
      };
      return {
        overlaps: chipEl.bottom > bb.top && chipEl.top < bb.bottom,
        price: hit('.detail-page__mobile-bar-amount'),
        cta: hit('.detail-page__mobile-bar .detail-page__cta-btn'),
      };
    });
    expect(hits.overlaps, 'precondition: chip and bar must overlap vertically').toBe(true);
    expect(hits.price, 'price label must be topmost inside the bar').toBe(true);
    expect(hits.cta, 'CTA must be topmost inside the bar').toBe(true);
  });
}
