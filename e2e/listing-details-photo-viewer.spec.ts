import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eListingDetails, e2eListingImages } from './support/fixtures';

/**
 * Regression (#273): the photo viewer (p-dialog) was rendered inline inside the details page's
 * hero, which is its own stacking context (`z-index: 0`), so the sheet, the sticky booking
 * bar/sidebar and the app header painted OVER it. jsdom has no stacking engine, so only a real
 * browser proves the fix (`appendTo="body"`): with the viewer open, `elementFromPoint` at the
 * close button, counter and photo must land inside the viewer.
 */
test.use({ locale: 'hy-AM' });

const SVG_PHOTO =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#6b8e9b"/></svg>';

async function openViewer(page: Page): Promise<void> {
  await page.route('**/e2e-fixtures/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG_PHOTO }),
  );
  await mockApi(page, { listingDetails: e2eListingDetails({ images: e2eListingImages(4) }) });
  await page.goto('/listings/listing-e2e-1');
  await page
    .locator('.listing-gallery__hero-tap:visible, .listing-gallery__mtile--main-stack:visible')
    .first()
    .click();
  const viewer = page.locator('.listing-gallery__lightbox');
  await expect(viewer).toBeVisible();
  // Let PrimeNG's enter animation settle before measuring/clicking.
  await expect(
    page.locator('.p-dialog-mask[class*="enter-active"], .p-dialog[class*="enter-active"]'),
  ).toHaveCount(0);
  await page.waitForTimeout(300);
}

for (const [width, height] of [
  [390, 844],
  [1440, 900],
]) {
  test(`photo viewer is above all page chrome at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openViewer(page);

    const hits = await page.evaluate(() => {
      const viewer = document.querySelector('.listing-gallery__lightbox')!;
      const inside = (sel: string) => {
        const b = document.querySelector(sel)!.getBoundingClientRect();
        const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!el && viewer.contains(el);
      };
      return {
        close: inside('.listing-gallery__lightbox-close'),
        counter: inside('.listing-gallery__lightbox-counter'),
        photo: inside('.listing-gallery__lightbox-img'),
        portalled: document.body === document.querySelector('.p-dialog-mask')!.parentElement,
        // Pixel-parity: pure black surface.
        bg: getComputedStyle(viewer).backgroundColor,
      };
    });
    expect(hits.portalled, 'dialog mask must be portalled to <body>').toBe(true);
    expect(hits.close, 'close button topmost').toBe(true);
    expect(hits.counter, 'counter topmost').toBe(true);
    expect(hits.photo, 'photo topmost').toBe(true);
    expect(hits.bg).toBe('rgb(0, 0, 0)');

    // Real mouse click at the close button's coordinates (not a synthetic locator click).
    const box = (await page.locator('.listing-gallery__lightbox-close').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.listing-gallery__lightbox')).toHaveCount(0);
  });
}

test('photo viewer arrows do not wrap at the ends (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openViewer(page);
  const counter = page.locator('.listing-gallery__lightbox-counter');
  await expect(counter).toHaveText('1 / 4');
  await expect(page.locator('.listing-gallery__lightbox-nav--prev')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expect(counter).toHaveText('1 / 4');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(counter).toHaveText('4 / 4');
  await expect(page.locator('.listing-gallery__lightbox-nav--next')).toHaveCount(0);
});
