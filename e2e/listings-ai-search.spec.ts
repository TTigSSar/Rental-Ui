import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eDistricts, e2eListing, e2eUser } from './support/fixtures';
import { enText } from './support/i18n';

/**
 * AI search (ADR-054, Trello "AI Search 4/6") — the journeys that must not break silently.
 *
 * Why the mocked tier: the behaviour is a composition no unit test covers end to end — the switch
 * (URL `?ai=1`), the description in the store (never in the URL), the effect that POSTs it, the
 * reducer that turns `appliedFilters` into the filter chips, and the page that draws the ranked /
 * rest-of-catalogue divider. The backend is stubbed (`api-mock.ts`), so these prove UI wiring
 * only; the real endpoint, its ranking and its limits are not exercised here.
 *
 * Desktop viewport: the page renders two copies of the field (mobile bar, hidden by CSS, and the
 * block above the results), so every locator is scoped to `.lp-ai-top`.
 */

const KENTRON_ID = e2eDistricts().find((d) => d.code === 'kentron')!.id;
const DESCRIPTION = 'A balance bike for my 3-year-old, up to 3000 a day, in Kentron';

const RANKED = [
  e2eListing({ id: 'ai-1', title: 'AI Ranked Balance Bike' }),
  e2eListing({ id: 'ai-2', title: 'AI Ranked Scooter' }),
  e2eListing({ id: 'ai-3', title: 'AI Ranked Tricycle' }),
];
const REST = [
  e2eListing({ id: 'ai-4', title: 'AI Rest Puzzle' }),
  e2eListing({ id: 'ai-5', title: 'AI Rest Lego' }),
];

function filters(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: null,
    ageGroup: null,
    maxPrice: null,
    districtIds: null,
    nearHome: false,
    radiusKm: null,
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    items: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
    hasMore: false,
    appliedFilters: filters(),
    ranked: false,
    intent: null,
    widenedDistrictIds: [],
    purposeWidened: false,
    datesMentioned: false,
    locationNotConsidered: false,
    aiUnavailable: false,
    ...overrides,
  };
}

function errorBody(status: number, errorCode: string) {
  return {
    type: `urn:rental:error:${errorCode}`,
    title: 'Too many requests',
    status,
    detail: 'server prose that the UI must never show',
    errorCode,
  };
}

/** Signed in the way every mocked journey does: a token in storage before the app boots. */
async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'e2e-jwt-token');
  });
}

function aiField(page: Page): Locator {
  return page.locator('.lp-ai-top app-ai-search-field');
}

function aiSwitch(page: Page): Locator {
  return aiField(page).getByRole('switch', { name: enText('listings.ai.switchAria') });
}

function descriptionBox(page: Page): Locator {
  return aiField(page).getByRole('textbox', { name: enText('listings.ai.fieldAria') });
}

async function cardTitles(page: Page): Promise<string[]> {
  return (await page.locator('app-listing-card').allInnerTexts()).map((text) =>
    text.split('\n').find((line) => line.trim().startsWith('AI ') || line.trim().startsWith('E2E'))!.trim(),
  );
}

async function switchOnAndSearch(page: Page): Promise<void> {
  await aiSwitch(page).click();
  await expect(aiSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await descriptionBox(page).fill(DESCRIPTION);
  await aiField(page).getByRole('button', { name: enText('listings.ai.submit') }).click();
}

test.describe('Listings — AI search', () => {
  test('signed in: description -> applied-filter chips and ranked results in the server order, page 2 adds the divider', async ({
    page,
  }) => {
    const requests: unknown[] = [];
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser(),
      myListings: [],
      listings: [e2eListing()],
      aiSearchLog: requests,
      aiSearch: {
        bodyByPage: {
          1: response({
            items: RANKED,
            totalCount: 5,
            hasMore: true,
            ranked: true,
            intent: 'A balance bike for a 3-year-old',
            appliedFilters: filters({ ageGroup: '36-72', maxPrice: 3000, districtIds: [KENTRON_ID] }),
          }),
          2: response({ items: REST, page: 2, totalCount: 5, hasMore: false, ranked: false }),
        },
      },
    });
    await signIn(page);

    await page.goto('/listings');
    await switchOnAndSearch(page);

    // Page 1: the first request carries the typed description and no filters (the server parses them).
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests[0]).toMatchObject({ description: DESCRIPTION, filters: null, page: 1 });

    // Ranked cards, in exactly the order the server returned them.
    await expect(page.getByText('AI Ranked Tricycle')).toBeVisible();

    // Applied filters surface as the active-filter chips (the control a user can edit afterwards).
    const chips = page.getByRole('list', { name: 'Active filters' });
    await expect(chips.getByText('Kentron')).toBeVisible();
    await expect(chips.getByText(/Up to .* per day/)).toBeVisible();
    await expect(chips.getByRole('listitem')).toHaveCount(3);

    // The description lives in the store, never in the URL; the switch is.
    await expect(page).toHaveURL(/[?&]ai=1/);
    expect(page.url()).not.toContain('balance');

    // Page 2 (infinite scroll): the divider separates the ranked head from the rest of the catalogue.
    const divider = page.getByRole('separator').filter({ hasText: enText('listings.ai.moreListings') });
    await expect(divider).toBeVisible();
    await expect(page.getByText('AI Rest Lego')).toBeVisible();
    expect(await cardTitles(page)).toEqual([
      'AI Ranked Balance Bike',
      'AI Ranked Scooter',
      'AI Ranked Tricycle',
      'AI Rest Puzzle',
      'AI Rest Lego',
    ]);
    // The divider sits exactly between the ranked block and the rest.
    await expect(
      page.locator('app-listing-card, .lp-ai-divider').nth(3),
    ).toHaveClass(/lp-ai-divider/);

    // Page 2 asked for page 2 of the same description and told the server what was already shown.
    const page2 = requests.find((r) => (r as { page: number }).page === 2) as {
      description: string;
      excludeIds: string[];
    };
    expect(page2.description).toBe(DESCRIPTION);
    expect(page2.excludeIds).toEqual(['ai-1', 'ai-2', 'ai-3']);
  });

  test('aiUnavailable: the info notice shows, the switch turns off, the description is kept', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {
      me: e2eUser(),
      myListings: [],
      listings: [e2eListing()],
      aiSearch: { body: response({ items: [e2eListing()], totalCount: 1, aiUnavailable: true }) },
    });
    await signIn(page);

    await page.goto('/listings');
    await switchOnAndSearch(page);

    await expect(page.getByText(enText('listings.ai.unavailable'))).toBeVisible();
    await expect(aiSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(page).not.toHaveURL(/[?&]ai=1/);
    // Plain catalogue results are still on screen, and the field is back to the ordinary search box.
    await expect(page.getByText('E2E Wooden Train Set')).toBeVisible();
    await expect(aiField(page).getByRole('searchbox')).toBeVisible();

    // The description survives for the next attempt: switching AI on again brings it back.
    await aiSwitch(page).click();
    await expect(descriptionBox(page)).toHaveValue(DESCRIPTION);
  });

  test('rate limit and daily limit each show their own notice and leave the normal search usable', async ({
    page,
  }) => {
    await mockTiles(page);
    // Mutable per-test answer: first the per-minute 429, then the daily 429.
    let limit: { status: number; errorCode: string } = {
      status: 429,
      errorCode: 'ai_search.rate_limited',
    };
    await mockApi(page, { me: e2eUser(), myListings: [], listings: [e2eListing()] });
    await page.route('**/api/listings/ai-search', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: limit.status,
        contentType: 'application/problem+json',
        body: JSON.stringify(errorBody(limit.status, limit.errorCode)),
      });
    });
    await signIn(page);

    await page.goto('/listings');
    await switchOnAndSearch(page);

    const rate = aiField(page).getByRole('status').filter({ hasText: enText('listings.ai.rateLimited') });
    await expect(rate).toBeVisible();
    // Copy comes from translations, never from the server's prose (ADR-045).
    await expect(page.getByText('server prose that the UI must never show')).toHaveCount(0);
    // The description and the AI mode stay so the user can retry.
    await expect(descriptionBox(page)).toHaveValue(DESCRIPTION);
    await expect(aiSwitch(page)).toHaveAttribute('aria-checked', 'true');

    // Daily limit: its own text, and the per-minute text is gone.
    limit = { status: 429, errorCode: 'ai_search.daily_limit' };
    await aiField(page).getByRole('button', { name: enText('listings.ai.submit') }).click();
    const daily = aiField(page).getByRole('status').filter({ hasText: enText('errors.aiSearchDailyLimit') });
    await expect(daily).toBeVisible();
    await expect(rate).toHaveCount(0);

    // Regular search is still usable: switching AI off restores the ordinary box and the catalogue.
    await aiSwitch(page).click();
    await expect(aiSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(daily).toHaveCount(0);
    const search = aiField(page).getByRole('searchbox');
    await expect(search).toBeVisible();
    await expect(page.getByText('E2E Wooden Train Set')).toBeVisible();
    const queried = page.waitForRequest(
      (req) =>
        req.method() === 'GET' &&
        new URL(req.url()).pathname.endsWith('/api/listings') &&
        new URL(req.url()).searchParams.get('search') === 'train',
    );
    await search.fill('train');
    await queried;
  });

  test('guest: submit opens the sign-in dialog, and signing in resumes the search with the typed description', async ({
    page,
  }) => {
    const requests: unknown[] = [];
    await mockTiles(page);
    await mockApi(page, {
      // Not stored as a token before the app boots, so the visitor is a guest until they log in;
      // after /api/auth/login the working /me answers with this user.
      me: e2eUser(),
      login: { token: 'e2e-jwt-token' },
      myListings: [],
      listings: [e2eListing()],
      aiSearchLog: requests,
      aiSearch: {
        body: response({
          items: RANKED,
          totalCount: 3,
          ranked: true,
          appliedFilters: filters({ districtIds: [KENTRON_ID] }),
        }),
      },
    });

    await page.goto('/listings');
    await aiSwitch(page).click();
    await descriptionBox(page).fill(DESCRIPTION);
    await aiField(page).getByRole('button', { name: enText('listings.ai.submit') }).click();

    // A guest never reaches the endpoint; the existing sign-in dialog opens instead.
    const form = page.locator('form.auth-form');
    await expect(form).toBeVisible();
    expect(requests).toHaveLength(0);

    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('supersecret');
    await form.locator('button[type="submit"]').click();

    // Signed in: the dialog closes and the pending search runs with what was typed before.
    await expect(form).toBeHidden();
    await expect(page.getByText('AI Ranked Balance Bike')).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ description: DESCRIPTION, filters: null, page: 1 });
    await expect(descriptionBox(page)).toHaveValue(DESCRIPTION);
    await expect(aiSwitch(page)).toHaveAttribute('aria-checked', 'true');
  });
});
