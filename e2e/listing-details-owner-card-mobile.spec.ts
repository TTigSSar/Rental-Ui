import { expect, test } from '@playwright/test';

import { e2eListingDetails } from './support/fixtures';
import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';

/**
 * Regression (fix 1f1ecf8, SCSS-only): on listing details at <=~390px in hy-AM the owner card's
 * "view profile" button was squeezed next to the identity block (overlapping it) and the three stat
 * tiles overflowed the card. jsdom has no layout engine, so only a real browser can prove it.
 * Red on the parent (4d7559f): identity squeezed to ~30px beside a narrow button, button not full width,
 * third stat tile exceeds the stats padding box (360px). Overlap/within-card checks stay as guards.
 *
 * Deliberately NOT asserted: documentElement.scrollWidth <= innerWidth - a pre-existing, unrelated
 * 2px page-level overflow exists at these widths (before and after the fix).
 */
test.use({ locale: 'hy-AM' });

const PUBLIC_PROFILE = {
  id: 'owner-e2e-1',
  firstName: 'Olive',
  lastName: 'Owner',
  avatarUrl: null,
  memberSince: '2026-01-15T10:00:00.000Z',
  averageRating: 4.8,
  reviewCount: 12,
  activeListingsCount: 5,
  location: 'Yerevan, Armenia',
  isVerified: true,
  isIdConfirmed: true,
  isEmailPhoneConfirmed: true,
  ownerRating: 4.8,
  ownerReviewCount: 12,
  completedRentalsAsOwner: 20,
  responseRate: null,
  hygieneScore: null,
  hygieneStandards: [],
  renterRating: null,
  renterReviewCount: 0,
  completedRentalsAsRenter: 0,
  onTimeReturnRate: null,
  damageClaims: 0,
  reliabilityMetrics: [],
};

for (const [width, height] of [
  [360, 740],
  [390, 844],
]) {
  test(`owner card layout holds together at ${width}px (hy-AM)`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockTiles(page);
    await mockApi(page, { listingDetails: e2eListingDetails(), publicProfile: PUBLIC_PROFILE });
    await page.goto('/listings/listing-e2e-1');

    const card = page.locator('.detail-page__owner-card');
    await expect(card).toBeVisible();
    await page.addStyleTag({
      content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}',
    });
    await card.scrollIntoViewIfNeeded();
    await expect(page.locator('.detail-page__owner-stat'), 'precondition: three stat tiles').toHaveCount(3);

    const m = await page.evaluate(() => {
      const rect = (el: Element) => el.getBoundingClientRect();
      const cardEl = document.querySelector('.detail-page__owner-card')!;
      const btn = rect(document.querySelector('.detail-page__owner-message-btn')!);
      const identity = rect(document.querySelector('.detail-page__owner-identity')!);
      const c = rect(cardEl);
      const row = document.querySelector('.detail-page__owner-row')!;
      const rr = rect(row);
      const cs = getComputedStyle(row);
      const innerLeft = rr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      const innerRight = rr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
      return {
        btn: { left: btn.left, right: btn.right, width: btn.width, top: btn.top, bottom: btn.bottom },
        identity: { left: identity.left, right: identity.right, top: identity.top, bottom: identity.bottom },
        card: { left: c.left, right: c.right },
        identityWidth: identity.right - identity.left,
        statsBox: (() => {
          const el = document.querySelector('.detail-page__owner-stats')!;
          const r = rect(el);
          const st = getComputedStyle(el);
          return { left: r.left + parseFloat(st.paddingLeft), right: r.right - parseFloat(st.paddingRight) };
        })(),
        innerWidth: innerRight - innerLeft,
        stats: Array.from(document.querySelectorAll('.detail-page__owner-stat')).map((s) => {
          const r = rect(s);
          return { left: r.left, right: r.right };
        }),
        viewport: window.innerWidth,
      };
    });

    const intersects =
      m.btn.left < m.identity.right &&
      m.btn.right > m.identity.left &&
      m.btn.top < m.identity.bottom &&
      m.btn.bottom > m.identity.top;
    expect.soft(intersects, 'message button must not overlap the owner identity').toBe(false);

    expect.soft(Math.abs(m.btn.width - m.innerWidth), 'button spans the full inner width of the card row (card has no own padding)').toBeLessThanOrEqual(1);

    expect.soft(Math.abs(m.identityWidth - m.innerWidth), 'identity takes its own full-width line, not squeezed beside the button').toBeLessThanOrEqual(1);

    for (const [i, s] of m.stats.entries()) {
      expect.soft(s.right, `stat ${i} right edge inside the stats padding box`).toBeLessThanOrEqual(m.statsBox.right + 0.5);
      expect.soft(s.left, `stat ${i} left edge inside the stats padding box`).toBeGreaterThanOrEqual(m.statsBox.left - 0.5);
      expect.soft(s.left, `stat ${i} left edge inside card`).toBeGreaterThanOrEqual(m.card.left - 0.5);
      expect.soft(s.right, `stat ${i} right edge inside card`).toBeLessThanOrEqual(m.card.right + 0.5);
    }

    expect.soft(m.card.left, 'card starts inside viewport').toBeGreaterThanOrEqual(-0.5);
    expect.soft(m.card.right, 'card does not exceed viewport width').toBeLessThanOrEqual(m.viewport + 0.5);
  });
}
