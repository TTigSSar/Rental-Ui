import { expect, test, type Page, type Request } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eDistrict, e2eHomePoint, e2eListing, e2eUser } from './support/fixtures';

/**
 * Home-point model, renter side: a signed-in user who HAS a home point opens
 * `/listings` cold.
 *
 * Why this journey exists at the mocked tier rather than as a unit test: the
 * composition is the behaviour. Four separate pieces have to line up on a
 * first load — `/api/auth/me` landing a `homePoint` in the auth store,
 * `ListingsEffects.defaultOriginToHomePoint$` turning that into a `'home'`
 * origin, `RadiusOriginFilterComponent` rendering the segmented row with the
 * home option already selected, and `ListingsApiService`'s query seam
 * deciding what does and does not go on the wire. Each of those has unit
 * coverage in isolation and all of it was green while the feature was
 * broken on the real path: the effects are route-scoped
 * (`provideEffects(ListingsEffects)` in `listings/routes.ts`), so the lazy
 * chunk registered them AFTER `/api/auth/me` had already answered, and an
 * action-triggered version of the effect therefore missed its trigger on
 * essentially every cold load — all three origin rows unselected, radius
 * still reading "set a point first". A live walk found it; nothing below the
 * browser could. This spec is that walk, pinned.
 *
 * The three things it holds down, in order of how expensive they'd be to get
 * wrong:
 *   1. the home origin is preselected with no interaction at all;
 *   2. nothing about it reaches the network until the renter picks a radius —
 *      no `originLat`/`originLng`/`radiusKm`, no distance badges. The home
 *      point is the most sensitive coordinate this app holds (ADR-008) and
 *      the renter never asked to search by distance yet (product decision,
 *      Tigran 2026-10-05);
 *   3. when they do pick one, the coordinates that leave the client are
 *      ROUNDED to 3 decimals (~100 m), never the precise pair the store
 *      holds — `roundCoordForApi` at the single outbound seam.
 * Plus the negative: a signed-in renter with NO home point must see the
 * filter exactly as it was before this feature existed.
 */

/**
 * Deliberately precise, with a non-zero 4th decimal in both components, so
 * the rounding assertion can only pass if `roundCoordForApi` actually ran:
 * 40.187654 → 40.188 and 44.509876 → 44.510.
 */
const HOME_LAT = 40.187654;
const HOME_LNG = 44.509876;

function renterWithHomePoint() {
  return e2eUser({
    homePoint: e2eHomePoint({
      latitude: HOME_LAT,
      longitude: HOME_LNG,
      district: e2eDistrict(),
    }),
  });
}

function isListingsGet(req: Request): boolean {
  if (req.method() !== 'GET') return false;
  return new URL(req.url()).pathname.endsWith('/api/listings');
}

function hasDistanceParams(url: string): boolean {
  const params = new URL(url).searchParams;
  return params.has('originLat') || params.has('originLng') || params.has('radiusKm');
}

/** Signs in the way every other mocked journey does: a token in storage, set
 *  before the app boots, so `/api/auth/me` is answered from the seed. */
async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'e2e-jwt-token');
  });
}

test.describe('Listings — the home point as the default origin', () => {
  test('cold load preselects "From your home", sends nothing until a radius is picked, then sends it rounded', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {
      me: renterWithHomePoint(),
      // Not the viewer's own toy: `ListingCardComponent` suppresses the
      // distance badge for a listing you own (it would be narrating your own
      // address back at you), and `myListings` is where the page learns which
      // those are.
      myListings: [],
      listings: [e2eListing()],
      listingsDistanceKm: 1.4,
    });
    await signIn(page);

    // Every catalogue request of the whole journey, in order — the "no
    // coordinates on the wire" claim is about ALL of them, not just the one
    // a `waitForRequest` happens to catch.
    const listingsRequests: string[] = [];
    page.on('request', (req) => {
      if (isListingsGet(req)) listingsRequests.push(req.url());
    });

    await page.goto('/listings');

    const sidebar = page.locator('.lp-sidebar');
    const homeRow = sidebar.getByRole('radio', { name: /From your home/ });

    // ── 1. Preselected, with zero interaction ─────────────────────────
    // Nothing between `goto` and here clicks anything. `aria-checked`, not
    // the CSS modifier, because the row is a real radio to assistive tech.
    await expect(homeRow).toHaveAttribute('aria-checked', 'true');
    await expect(homeRow).toContainText('Kentron');
    // The other two options stay offered and unselected.
    await expect(sidebar.getByRole('radio', { name: /Use my location/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(sidebar.getByRole('radio', { name: /Pick on map/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );

    // ── 2. An origin, but no radius: nothing on the wire, no badges ───
    // The radius reads "Any distance" rather than a number the API is not
    // filtering by — the user-visible half of the same decision.
    await expect(sidebar.locator('.rof__radius-val')).toContainText('Any distance');
    await expect(page.locator('.listing-card__distance-badge')).toHaveCount(0);

    // Wait for the catalogue to have actually rendered, so "no request
    // carried the params" is a statement about a finished load and not about
    // a load that hadn't started.
    await expect(page.locator('app-listing-card').first()).toBeVisible();
    expect(listingsRequests.length).toBeGreaterThan(0);
    for (const url of listingsRequests) {
      expect(hasDistanceParams(url), `unexpected distance params in ${url}`).toBe(false);
    }
    await expect(page).not.toHaveURL(/radiusKm/);

    // ── 3. Pick a radius: now, and only now, the origin is sent ──────
    const withRadius = page.waitForRequest(
      (req) => isListingsGet(req) && new URL(req.url()).searchParams.has('radiusKm'),
    );
    await sidebar.getByRole('button', { name: '3 km', exact: true }).click();
    const params = new URL((await withRadius).url()).searchParams;

    expect(params.get('radiusKm')).toBe('3');
    // Rounded to 3 decimals at the outbound seam (`roundCoordForApi`), never
    // the store's precise pair. Compared as numbers because 44.510 serializes
    // as "44.51" — a trailing zero is not information, the 4th decimal is.
    expect(Number(params.get('originLat'))).toBe(40.188);
    expect(Number(params.get('originLng'))).toBe(44.51);
    // The precise coordinates must not appear in any form.
    expect(params.get('originLat')).not.toContain('40.1876');
    expect(params.get('originLng')).not.toContain('44.5098');

    // ── 3b. The badge appears, in the HOME variant ───────────────────
    // "from your home" and "from you" are different claims; the orange
    // home-icon pill is the one that may render here.
    const badge = page.locator('.listing-card__distance-badge').first();
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('from your home');
    await expect(badge).toHaveClass(/listing-card__distance-badge--home/);
    await expect(badge).not.toHaveClass(/listing-card__distance-badge--live/);
    await expect(badge.locator('span.pi.pi-home')).toHaveCount(1);
    await expect(badge.locator('span.pi-compass')).toHaveCount(0);
  });

  test('a signed-in renter with no home point sees no home row at all, and the filter behaves as before', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser({ homePoint: null }),
      myListings: [],
      listings: [e2eListing()],
      listingsDistanceKm: 1.4,
    });
    await signIn(page);

    const listingsRequests: string[] = [];
    page.on('request', (req) => {
      if (isListingsGet(req)) listingsRequests.push(req.url());
    });

    await page.goto('/listings');
    await expect(page.locator('app-listing-card').first()).toBeVisible();

    const sidebar = page.locator('.lp-sidebar');

    // Hidden, NOT rendered-disabled (approved design): a disabled row would
    // advertise a feature with no affordance to reach it, and this control is
    // not where a home point gets set. So: no radiogroup, no row, in any
    // state.
    await expect(sidebar.locator('.rof__segrow')).toHaveCount(0);
    await expect(sidebar.getByRole('radio', { name: /From your home/ })).toHaveCount(0);
    await expect(sidebar.getByRole('radiogroup')).toHaveCount(0);

    // Byte-for-byte the pre-feature control: the "unset" state card with its
    // own detect/pick affordances, and a locked slider.
    await expect(sidebar.locator('.rof__origin--unset')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Detect my location' })).toBeVisible();
    await expect(sidebar.locator('.rof__radius-val')).toContainText('set a point first');
    await expect(sidebar.locator('.rof__slider')).toBeDisabled();

    // And with no origin, nothing distance-shaped is requested or rendered.
    expect(listingsRequests.length).toBeGreaterThan(0);
    for (const url of listingsRequests) {
      expect(hasDistanceParams(url), `unexpected distance params in ${url}`).toBe(false);
    }
    await expect(page.locator('.listing-card__distance-badge')).toHaveCount(0);
  });
});
