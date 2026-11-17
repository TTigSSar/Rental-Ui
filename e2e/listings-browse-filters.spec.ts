import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eListing } from './support/fixtures';
import { enText } from './support/i18n';

/**
 * Browse Redesign Stage 1 (Trello #271, ADR-066): the multi-select filter panel, server sort, active
 * chips and the facets call, wired through the REAL Angular app with the backend stubbed
 * (`api-mock.ts`). Proves UI wiring only (URL keys, request params, chips, counts); server-side
 * filtering/ranking is xUnit's. Locators prefer roles and visible text over CSS.
 */

const CATEGORIES = [
  { id: 'cat-e2e-toys', name: 'Toys', nameHy: 'Toys', nameRu: 'Toys', slug: 'toys', iconName: 'tag', colorHex: '#FFE6CC' },
  { id: 'cat-e2e-puzzles', name: 'Puzzles', nameHy: 'Puzzles', nameRu: 'Puzzles', slug: 'puzzles', iconName: 'tag', colorHex: '#CCE6FF' },
  { id: 'cat-e2e-bikes', name: 'Bikes', nameHy: 'Bikes', nameRu: 'Bikes', slug: 'bikes', iconName: 'tag', colorHex: '#E6FFCC' },
];
const FACETS = {
  categories: [
    { categoryId: 'cat-e2e-toys', count: 7 },
    { categoryId: 'cat-e2e-puzzles', count: 3 },
    { categoryId: 'cat-e2e-bikes', count: 2 },
  ],
  districts: [],
  minPricePerDay: 500,
  maxPricePerDay: 4000,
};

/** Every value of a list param whether the app repeats the key or comma-joins it. */
function listParam(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((v) => v.split(','))
    .filter(Boolean);
}

function trackListingsRequests(page: Page): URL[] {
  const seen: URL[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (req.method() === 'GET' && url.pathname.endsWith('/api/listings')) seen.push(url);
  });
  return seen;
}

test.describe('Listings — Browse Redesign filters (ADR-066)', () => {
  test('desktop: categories + condition, sort, chip removal and Clear all keep URL, request and chips in step', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const requests = trackListingsRequests(page);
    const facetsLog: URL[] = [];
    await mockApi(page, {
      listings: [e2eListing()],
      categories: CATEGORIES,
      facets: FACETS,
      facetsLog,
    });

    await page.goto('/listings');
    const panel = page.getByRole('complementary', { name: enText('listings.filters.sidebar.title') });
    const chips = page.getByRole('list', { name: enText('listings.page.activeFiltersAria') });

    // Facet counts render in the category rows; no chips before any selection.
    await expect(panel.getByRole('checkbox', { name: /Toys/ })).toContainText('7');
    await expect(panel.getByRole('checkbox', { name: /Puzzles/ })).toContainText('3');
    await expect(panel.getByRole('checkbox', { name: /Bikes/ })).toContainText('2');
    await expect(chips).toHaveCount(0);

    // Two categories + one condition.
    await panel.getByRole('checkbox', { name: /Toys/ }).click();
    await panel.getByRole('checkbox', { name: /Puzzles/ }).click();
    await panel.getByRole('button', { name: enText('listings.browse.sections.condition') }).click();
    await panel.getByRole('button', { name: 'New', exact: true }).click();

    await expect(page).toHaveURL(/[?&]categoryIds=/);
    await expect(page).toHaveURL(/[?&]conditions=New(&|$)/);
    const url = new URL(page.url());
    expect(listParam(url.searchParams, 'categoryIds').sort()).toEqual(['cat-e2e-puzzles', 'cat-e2e-toys']);
    expect(listParam(url.searchParams, 'conditions')).toEqual(['New']);

    // The catalogue request carries repeated categoryIds and conditions.
    await expect
      .poll(() => {
        const last = requests.at(-1);
        return last
          ? [last.searchParams.getAll('categoryIds').sort(), last.searchParams.getAll('conditions')]
          : null;
      })
      .toEqual([['cat-e2e-puzzles', 'cat-e2e-toys'], ['New']]);
    // Facets are re-requested with the same filters and never carry sort/paging/bbox.
    await expect.poll(() => facetsLog.at(-1)?.searchParams.getAll('categoryIds').length).toBe(2);
    for (const f of facetsLog) {
      for (const forbidden of ['sort', 'page', 'pageSize', 'minLat', 'maxLat']) {
        expect(f.searchParams.has(forbidden)).toBe(false);
      }
    }

    // Chips: one per value.
    await expect(chips.getByRole('listitem')).toHaveCount(3);
    await expect(chips.getByRole('listitem').filter({ hasText: 'Toys' })).toBeVisible();
    await expect(chips.getByRole('listitem').filter({ hasText: 'Puzzles' })).toBeVisible();
    await expect(chips.getByRole('listitem').filter({ hasText: 'New' })).toBeVisible();

    // Section count badges.
    await expect(panel.getByTestId('badge-cat')).toHaveText('2');
    await expect(panel.getByTestId('badge-cond')).toHaveText('1');
    await expect(panel.getByTestId('total-badge')).toHaveText('3');

    // Sort: Nearest is disabled without an origin; Price low to high goes to the server and the URL.
    await page.getByRole('button', { name: /^Sort:/ }).click();
    await expect(page.getByRole('option', { name: /Nearest first/ })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('option', { name: enText('listings.page.sortPriceAsc') }).click();
    await expect(page).toHaveURL(/[?&]sort=price_asc(&|$)/);
    await expect.poll(() => requests.at(-1)?.searchParams.get('sort')).toBe('price_asc');
    // Facets never get a sort, even after the sort change.
    expect(facetsLog.every((f) => !f.searchParams.has('sort'))).toBe(true);

    // Removing one chip removes only that value.
    await chips
      .getByRole('button', { name: enText('listings.browse.removeChip').replace('{{label}}', 'Puzzles') })
      .click();
    await expect(chips.getByRole('listitem')).toHaveCount(2);
    const afterRemove = new URL(page.url());
    expect(listParam(afterRemove.searchParams, 'categoryIds')).toEqual(['cat-e2e-toys']);
    expect(listParam(afterRemove.searchParams, 'conditions')).toEqual(['New']);
    expect(afterRemove.searchParams.get('sort')).toBe('price_asc');

    // Clear all removes every filter but keeps the chosen order (ADR-066 / listings-page: clearing
    // filters is not changing the order).
    await chips.getByRole('button', { name: enText('listings.filters.sidebar.clearAll') }).click();
    await expect(page).toHaveURL(/\/listings\?sort=price_asc$/);
    await expect(chips).toHaveCount(0);
    await expect.poll(() => requests.at(-1)?.searchParams.getAll('categoryIds').length).toBe(0);
    expect(requests.at(-1)!.searchParams.has('conditions')).toBe(false);
    expect(requests.at(-1)!.searchParams.get('sort')).toBe('price_asc');

    // Back to the default order (Newest, the server default, omitted from the wire): bare /listings.
    await page.getByRole('button', { name: /^Sort:/ }).click();
    await page.getByRole('option', { name: enText('listings.page.sortNewest') }).click();
    await expect(page).toHaveURL(/\/listings$/);
    await expect.poll(() => requests.at(-1)?.searchParams.has('sort')).toBe(false);
  });

  test('a legacy ?categoryId= link still filters (sent as categoryIds) and shows its chip', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const requests = trackListingsRequests(page);
    await mockApi(page, { listings: [e2eListing()], categories: CATEGORIES, facets: FACETS });

    await page.goto('/listings?categoryId=cat-e2e-puzzles');

    await expect.poll(() => requests.at(-1)?.searchParams.getAll('categoryIds')).toEqual(['cat-e2e-puzzles']);
    expect(requests.some((r) => r.searchParams.has('categoryId'))).toBe(false);
    const chips = page.getByRole('list', { name: enText('listings.page.activeFiltersAria') });
    await expect(chips.getByRole('listitem').filter({ hasText: 'Puzzles' })).toBeVisible();
  });

  test('mobile 375: the new toolbar does not overflow, and the filter sheet applies a condition chip', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const requests = trackListingsRequests(page);
    await mockApi(page, { listings: [e2eListing()], categories: CATEGORIES, facets: FACETS });

    await page.goto('/listings');
    await expect(page.locator('.listing-card__title')).toContainText('E2E Wooden Train Set');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: enText('listings.filters.filterBtn'), exact: true }).click();
    const sheet = page.getByRole('dialog', { name: enText('listings.filters.filterBtn') });
    await sheet.getByRole('button', { name: 'Like new', exact: true }).click();
    await sheet.getByRole('button', { name: enText('listings.filters.filterSheet.apply') }).click();

    await expect(page).toHaveURL(/[?&]conditions=LikeNew(&|$)/);
    await expect.poll(() => requests.at(-1)?.searchParams.getAll('conditions')).toEqual(['LikeNew']);
    // The filter button shows how many filters are applied.
    await expect(page.locator('.lf-bar__filter-badge')).toHaveText('1');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(0);
  });
});
