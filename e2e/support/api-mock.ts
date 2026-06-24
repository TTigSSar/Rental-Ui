import type { Page, Route } from '@playwright/test';

/**
 * Network-level backend stub for E2E journeys. Install once per test with the
 * state the journey needs; every `/api/**` request is answered from this seed so
 * the journeys assert app behaviour, not server wiring.
 *
 * Unmatched GETs resolve to an empty success and unmatched writes to 200 {} so a
 * journey only has to declare the slice of state it cares about.
 */
export interface ApiSeed {
  /** GET /api/auth/me — null/omitted responds 401 (anonymous). */
  me?: unknown;
  /** GET /api/listings — items for the paged listings response. */
  listings?: unknown[];
  /** GET /api/admin/listings/pending */
  pendingListings?: unknown[];
  /** POST /api/auth/login outcome. */
  login?: { token?: string; status?: number; body?: unknown };
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function mockApi(page: Page, seed: ApiSeed = {}): Promise<void> {
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();

    if (pathname.endsWith('/api/auth/login')) {
      const status = seed.login?.status ?? 200;
      return json(
        route,
        status,
        seed.login?.body ?? { token: seed.login?.token ?? 'e2e-jwt-token' },
      );
    }

    if (pathname.endsWith('/api/auth/me')) {
      return seed.me ? json(route, 200, seed.me) : json(route, 401, { detail: 'Unauthenticated' });
    }

    if (pathname.endsWith('/api/admin/listings/pending')) {
      return json(route, 200, seed.pendingListings ?? []);
    }

    if (pathname.endsWith('/api/listings') && method === 'GET') {
      return json(route, 200, {
        items: seed.listings ?? [],
        page: 1,
        pageSize: 20,
        hasMore: false,
      });
    }

    // Anything else: keep the app happy with a benign success.
    if (method === 'GET') return json(route, 200, []);
    return json(route, 200, {});
  });
}
