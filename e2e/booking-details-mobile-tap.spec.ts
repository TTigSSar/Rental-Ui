import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eBookingDetail, e2eUser } from './support/fixtures';

/**
 * Regression coverage for Defect B (M-043): the booking-details page's sticky
 * `.booking-details__footer` sits UNDER the global `.app-bottom-nav` at ≤960px
 * because `isBookingFlowUrl()` in `app.ts` only ever matched
 * `/listings/:id/book`, never `/bookings/:id` — so every CTA on that footer
 * (owner approve/decline, owner markActive/complete, renter cancel) was
 * rendered but untappable on phone and tablet widths. A real live repro hit
 * exactly this: a real Playwright `.click()` on the Approve button failed with
 * "subtree intercepts pointer events" at 375px and 768px.
 *
 * Why this lives in the MOCKED tier, not the real-stack tier: the defect is a
 * pure CSS/layout property (`.app-shell--booking` suppresses
 * `.app-bottom-nav` — see app.css) of the real Angular app rendered by a real
 * browser engine. Both Playwright tiers use the same real browser and the same
 * built CSS; the only difference between them is whether `/api/**` is faked.
 * Nothing about hit-testing depends on real auth, real SQL persistence, or
 * real booking-lifecycle transitions, so faking the backend loses no coverage
 * here while avoiding the real tier's login-rate-limit budget and ~minutes
 * runtime. jsdom (vitest) is not an option at all — it has no real box model,
 * so an element being visually covered by another element is invisible to it
 * by construction; only a real browser viewport can catch this.
 *
 * Two independent proofs per CTA, per the M-043 spec:
 *  1. `elementFromPoint` at the button's own centre resolves to the button
 *     itself, not to the bottom nav — the literal measurement from the live
 *     repro.
 *  2. A real Playwright `.click()` completes within a bounded timeout — if the
 *     bottom nav (or anything else) still intercepted pointer events at that
 *     point, Playwright's own actionability check would time out on
 *     "subtree intercepts pointer events", exactly reproducing the live
 *     failure mode.
 */

/** Matches the mobile viewport convention already used by
 *  admin-users.spec.ts / admin-categories.spec.ts / admin-reports.spec.ts /
 *  home-hero-map.spec.ts (390×844, an iPhone-class width). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };
/** The bug report's other named breakpoint — tablet width, still ≤960px so
 *  the bottom nav is still a candidate to render at all. */
const TABLET_VIEWPORT = { width: 768, height: 1024 };

function bottomNav(page: Page) {
  return page.locator('.app-bottom-nav');
}

/**
 * The mobile-only app-open boot screen (`app.ts`'s `isMobileAtBoot` /
 * `MIN_BOOT_DISPLAY_MS`) is a `position: fixed; inset: 0` overlay that stays
 * on top of everything — including the booking-details footer — for at least
 * 600ms after construction, on every viewport ≤960px. It is unrelated to
 * Defect B, but at the SAME mobile/tablet widths this defect requires, it
 * would otherwise cover the whole viewport during that window and make
 * `elementFromPoint`/`.click()` resolve to IT instead of proving anything
 * about the bottom nav. Wait for its own hidden state
 * (`.dr-boot--hidden`, which also flips `pointer-events: none`) before
 * probing hit-testability.
 */
async function waitForBootScreenHidden(page: Page): Promise<void> {
  await expect(page.locator('.dr-boot')).toHaveClass(/dr-boot--hidden/, { timeout: 5_000 });
}

/** Resolves the DOM element at the CTA's own centre point and returns its
 *  class list — the literal `elementFromPoint` measurement from the live
 *  repro (pre-fix this returned the bottom nav's "Messages" link's class). */
async function classAtElementCentre(page: Page, locator: Locator): Promise<string> {
  const box = await locator.boundingBox();
  expect(box, 'CTA must have a layout box to probe').not.toBeNull();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  return page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.className ?? '',
    [cx, cy] as const,
  );
}

test.describe('Booking details footer — mobile/tablet tap-interception (Defect B)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  for (const viewport of [MOBILE_VIEWPORT, TABLET_VIEWPORT]) {
    test(`owner's Approve CTA is hit-testable at ${viewport.width}px, not swallowed by the bottom nav`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await mockApi(page, {
        me: e2eUser(),
        bookingDetail: e2eBookingDetail({ role: 'owner', status: 'Pending' }),
      });

      await page.goto('/bookings/booking-e2e-1');
      const approveBtn = page.getByRole('button', { name: 'Approve' });
      await expect(approveBtn).toBeVisible();
      await waitForBootScreenHidden(page);

      // The bottom nav renders in the DOM (showBottomNav doesn't special-case
      // booking pages) but must be display:none via `.app-shell--booking` —
      // confirmed directly, not just inferred from the click below.
      await expect(bottomNav(page)).toHaveCSS('display', 'none');

      const centreClass = await classAtElementCentre(page, approveBtn);
      expect(centreClass).toContain('booking-details__primary--split');
      expect(centreClass).not.toContain('app-bottom-nav');

      // The real proof: a real click must land, not time out. On the pre-fix
      // bundle this is exactly where Playwright reported "subtree intercepts
      // pointer events" against the bottom nav's Messages link.
      await Promise.all([
        page.waitForRequest(
          (req) =>
            req.url().endsWith('/api/bookings/booking-e2e-1/approve') && req.method() === 'POST',
        ),
        approveBtn.click({ timeout: 5_000 }),
      ]);

      // Reducer patches bookingDetail.status in place (approveBookingRequestSuccess) — the
      // footer flips to the owner's next-transition CTA with NO reload, proving the click's
      // effect actually reached the store, not just that boundingBox math lied.
      await expect(page.getByRole('button', { name: 'Mark as handed over' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    });
  }

  test('renter\'s Cancel CTA is hit-testable at mobile width, not swallowed by the bottom nav', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mockApi(page, {
      me: e2eUser(),
      bookingDetail: e2eBookingDetail({ role: 'renter', status: 'Pending' }),
    });

    await page.goto('/bookings/booking-e2e-1');
    const cancelBtn = page.getByRole('button', { name: 'Cancel request' });
    await expect(cancelBtn).toBeVisible();
    await waitForBootScreenHidden(page);

    await expect(bottomNav(page)).toHaveCSS('display', 'none');

    const centreClass = await classAtElementCentre(page, cancelBtn);
    expect(centreClass).toContain('booking-details__cancel');
    expect(centreClass).not.toContain('app-bottom-nav');

    // Real click must land: cancelBookingSuccess's effect navigates to /bookings — an
    // observable, unambiguous proof the tap actually reached the button's handler.
    await Promise.all([
      page.waitForURL('**/bookings'),
      cancelBtn.click({ timeout: 5_000 }),
    ]);
  });
});
