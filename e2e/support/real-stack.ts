import { expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * Helpers for the real-stack tier (`npm run e2e:real`). These talk to the REAL
 * docker stack — nginx UI on :4200, ASP.NET Core API on :8080, SQL Server —
 * and rely exclusively on dev-seed invariants (fixed GUIDs, demo accounts).
 * No api-mock.ts here.
 */

export const API_URL = 'http://localhost:8080';
export const UI_URL = 'http://localhost:4200';

/** Dev-seed demo accounts (idempotent seed, Development environment only). */
export const ACCOUNTS = {
  owner: { email: 'owner@rental.local', password: 'Demo1234' },
  renter: { email: 'renter@rental.local', password: 'Demo1234' },
  admin: { email: 'admin@rental.local', password: 'Demo1234' },
} as const;

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

/**
 * Seed invariant: "Wooden Toy Kitchen Set" (DevelopmentSeedData.ListingIds
 * .ToyKitchenSet), Approved, owned by owner@rental.local, 3,500 AMD/day (see
 * DevelopmentSeedData.cs — ADR-007 moved the app to dram-only pricing; this
 * was previously documented as "$9/day" before that migration). Its only
 * seeded bookings are terminal (Completed/…), so renter@ can always book it
 * once leftover bookings from crashed runs are released (see
 * releaseListingForRenter).
 *
 * `exactLatitude`/`exactLongitude` are the literal owner-dropped pin from
 * `DevelopmentSeedData.Listings` (`40.1776m, 44.5126m` — 5 Republic Square,
 * Yerevan). `ListingLocationBackfillExtensions.BackfillListingLocationsAsync`
 * runs unconditionally on every API startup and derives `PublicLatitude`/
 * `PublicLongitude` (the geohash-7 cell centroid, ADR-008 as amended
 * 2026-07-25, `GeohashSnapper.Precision = 7`) from that exact pair
 * deterministically, so the fuzzed public pair never drifts between runs
 * either.
 *
 * `publicLatitude`/`publicLongitude` are that geohash-7 centroid —
 * confirmed live: `40.177689, 44.513168`. This is a deliberate tripwire, not
 * a magic number: it is the actual centroid of the geohash-7 cell containing
 * the exact seed point, rounded to 6dp the same way `GeohashSnapper` does
 * (`MidpointRounding.AwayFromZero`). If `GeohashSnapper.Precision` ever
 * changes again, recompute these two values and update the ADR-008
 * amendment note alongside them — don't hand-wave a new number in.
 */
export const TOY_KITCHEN = {
  id: '77777777-0007-4000-9000-000000000007',
  title: 'Wooden Toy Kitchen Set',
  pricePerDay: 3_500,
  exactLatitude: 40.1776,
  exactLongitude: 44.5126,
  publicLatitude: 40.177689,
  publicLongitude: 44.513168,
  /**
   * `AddressLine` on the seeded listing — gated the same way the owner's
   * phone number used to be (`BookingsService`: `contactRevealed ?
   * listing.AddressLine : null`). The phone gate was removed from the
   * product entirely; the address gate is the one contact-reveal survivor,
   * so this is now what "Approved+" genuinely unlocks on a booking.
   */
  addressLine: '5 Republic Square',
} as const;

/**
 * M-011 stack guard — run before any real-stack journey.
 *
 * `ng serve` and the docker UI container fight over :4200, and a stale bundle
 * is indistinguishable from a fresh one by looking at the page. The docker UI
 * is served by nginx (Server: nginx response header); the Angular dev server
 * is not. The API must answer on :8080 (docker port; local `dotnet run` uses
 * 7241/5241, so a healthy :8080 means the docker API).
 */
export async function assertDockerStack(request: APIRequestContext): Promise<void> {
  const ui = await request.get(`${UI_URL}/`, { failOnStatusCode: false });
  const server = (ui.headers()['server'] ?? '').toLowerCase();
  if (!ui.ok() || !server.includes('nginx')) {
    throw new Error(
      `Real-stack guard: http://localhost:4200 is not the docker nginx UI ` +
        `(status ${ui.status()}, Server header: "${server || 'none'}" — an ng serve dev server?). ` +
        `Stop whatever owns :4200 and run: ` +
        `docker compose -f rental-api/docker-compose.yml up --build -d`,
    );
  }

  const api = await request.get(`${API_URL}/api/listings`, { failOnStatusCode: false });
  if (!api.ok()) {
    throw new Error(
      `Real-stack guard: docker API on :8080 is not healthy ` +
        `(GET /api/listings -> ${api.status()}). Is the docker stack up and seeded?`,
    );
  }
}

/**
 * Module-level JWT cache, keyed by account email.
 *
 * `AuthController`'s login endpoint carries `AuthPolicy` (5 requests/min,
 * partitioned by remote IP — see `RateLimiterExtensions.cs`), and because
 * every Playwright request reaches the docker API as one client IP, that
 * budget is shared by the ENTIRE `--project=real` run, not per spec file.
 * Before this cache, `apiSetPreferredLanguage`, `releaseListingForRenter`
 * and several specs each called `apiLogin` again for accounts an earlier
 * step — sometimes an earlier spec file in the same run — had already
 * logged in as moments before, and the suite routinely spent its whole
 * 5/min budget re-authenticating the same handful of demo accounts.
 *
 * Reuse is safe: the access token is a bearer string whose claims are
 * `Sub`/`NameIdentifier`/`Email`/`Role`/`Jti` only (see
 * `JwtTokenService.GenerateAccessToken`) — nothing mutable like preferred
 * language is baked in, so a cached token stays valid across e.g.
 * `language-persistence.spec.ts` changing `renter@`'s language mid-run.
 * `AccessTokenExpirationMinutes` is 60 in both dev configs, so `TOKEN_TTL_MS`
 * below (55 min) never actually gets hit by a normal test run and exists
 * purely as a defensive backstop, not because runs get anywhere near it.
 *
 * This only pays off with the `real` Playwright project pinned to
 * `workers: 1` (see playwright.config.ts): Playwright workers are separate
 * OS processes, so this module-level Map does not exist across workers —
 * under the old `fullyParallel` default each worker rebuilt its own cache
 * and the aggregate login count across the run was unchanged. Serialization
 * and caching are a package deal here, not two independent fixes.
 *
 * Also shared by `loginViaDialog` (below), deliberately: the first
 * `loginViaDialog` call for a given account per run still drives the real
 * dialog end to end (fill, submit, wait for the session to hydrate) and
 * caches the resulting token here, same as `apiLogin`. Every LATER call for
 * that same account in the same run — whether from `apiLogin` or
 * `loginViaDialog`, in whichever spec file asks first — reuses it. This
 * was proven necessary, not just tidy: with only `apiLogin` cached and
 * `workers: 1`, a repeat full `--project=real` run still hit 429s on the
 * *dialog* logins alone (`renter`/`owner`/`owner` across
 * booking-lifecycle.spec.ts, create-listing-photo-upload.spec.ts and
 * language-persistence.spec.ts — 3-4 real dialog submits per run is on its
 * own enough to exhaust the budget across two back-to-back runs). Re-
 * submitting the real login form more than once per account per run buys no
 * incremental regression protection either: the dialog's own mechanics
 * (validation, error states, success) are already pinned cheaply against
 * the mocked backend in `e2e/auth.spec.ts`; what the real tier uniquely
 * needs proven is the real backend round trip PLUS the Angular hydration
 * wiring (`AuthTokenService` -> `authInitStarted` -> `GET /api/auth/me`) —
 * and that only needs proving once per account, not once per spec file.
 */
const tokenCache = new Map<string, { token: string; loggedInAt: number }>();
const TOKEN_TTL_MS = 55 * 60 * 1000;

/**
 * Logs in through the real API and returns the JWT, reusing a cached token
 * for the same account when one is still fresh (see `tokenCache` doc above).
 */
export async function apiLogin(request: APIRequestContext, account: Credentials): Promise<string> {
  const cached = tokenCache.get(account.email);
  if (cached && Date.now() - cached.loggedInAt < TOKEN_TTL_MS) {
    return cached.token;
  }

  const res = await request.post(`${API_URL}/api/auth/login`, { data: account });
  if (!res.ok()) {
    throw new Error(`API login failed for ${account.email}: ${res.status()} ${await res.text()}`);
  }
  // The wire contract allows both spellings (BackendAuthResponse in the UI);
  // the current API sends `accessToken`.
  const body = (await res.json()) as { token?: string; accessToken?: string };
  const token = body.accessToken ?? body.token;
  if (!token) throw new Error(`API login for ${account.email} returned no token.`);
  tokenCache.set(account.email, { token, loggedInAt: Date.now() });
  return token;
}

interface MineBooking {
  readonly id: string;
  readonly listingId: string;
  readonly status: string;
}

/**
 * Determinism self-heal: bookings persist in the dev DB between runs, and a
 * run that crashed mid-journey can leave renter@ with a non-terminal booking
 * (Pending/Approved/Active) on the target listing — which disables the
 * "Request to rent" CTA and can block date ranges. Drive any such leftover to
 * a terminal state through the real API before the journey starts:
 *   Pending/Approved -> renter cancels; Active -> owner completes;
 *   Approved past its start date (not cancellable) -> owner activates + completes.
 */
export async function releaseListingForRenter(
  request: APIRequestContext,
  listingId: string,
): Promise<void> {
  const renterToken = await apiLogin(request, ACCOUNTS.renter);
  const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` });

  const mineRes = await request.get(`${API_URL}/api/bookings/mine`, {
    headers: authHeaders(renterToken),
  });
  expect(mineRes.ok(), 'GET /api/bookings/mine must succeed during self-heal').toBe(true);
  const mine = (await mineRes.json()) as MineBooking[];

  const blocking = mine.filter(
    (b) => b.listingId === listingId && ['Pending', 'Approved', 'Active'].includes(b.status),
  );
  if (blocking.length === 0) return;

  const ownerToken = await apiLogin(request, ACCOUNTS.owner);
  for (const booking of blocking) {
    if (booking.status === 'Pending' || booking.status === 'Approved') {
      const cancel = await request.post(`${API_URL}/api/bookings/${booking.id}/cancel`, {
        headers: authHeaders(renterToken),
        failOnStatusCode: false,
      });
      if (cancel.ok() || booking.status === 'Pending') continue;
      // Approved booking already past its start date: complete it as the owner.
      await request.post(`${API_URL}/api/bookings/${booking.id}/activate`, {
        headers: authHeaders(ownerToken),
        failOnStatusCode: false,
      });
    }
    await request.post(`${API_URL}/api/bookings/${booking.id}/complete`, {
      headers: authHeaders(ownerToken),
      failOnStatusCode: false,
    });
  }
}

/**
 * Determinism self-heal: sets an account's server-side `preferredLanguage`
 * directly through the real PUT endpoint before a journey starts, so the
 * test's starting state never depends on what a previous (possibly crashed
 * or intentionally language-switching) run left behind.
 *
 * Used by `real/language-persistence.spec.ts` itself (its own baseline, and
 * its cleanup — wrapped in try/finally there so it runs even if an assertion
 * above it throws) AND, separately, by `booking-lifecycle.spec.ts`'s own
 * guard step to reset `renter@` before its journey starts: that spec asserts
 * English locators throughout ('Request to rent', 'Cancel request', …), and
 * `language-persistence.spec.ts` deliberately drives `renter@` to `hy`
 * mid-test. A run that is killed outright (not just a failed assertion)
 * skips even a `finally`, and the dev DB is persistent — so a prior,
 * unrelated real-tier run can leave `renter@` on `hy` and silently break
 * every English locator in a completely different spec. Rather than trust
 * the previous run's cleanup, the spec that depends on the account being
 * English resets it itself, in its own guard step — the same self-heal
 * pattern as `releaseListingForRenter` for booking state.
 *
 * This is deliberately called per-spec (only where the risk is real — only
 * `renter@` is ever driven to a non-English language by any real spec today,
 * grep the call sites below), not once for every account from
 * `global-setup.ts` for the whole real-tier run: that was tried and
 * reverted. A global self-heal pays its login cost on every `--project=real`
 * invocation, including single-file runs, and stacks against the shared
 * `AuthPolicy` rate limit (5 logins/IP/min, partitioned by remote IP — see
 * `RateLimiterExtensions.cs`) hard enough that two back-to-back solo runs of
 * `booking-lifecycle.spec.ts` started 429ing purely from that self-heal's
 * own logins.
 */
export async function apiSetPreferredLanguage(
  request: APIRequestContext,
  account: Credentials,
  preferredLanguage: string | null,
): Promise<void> {
  const token = await apiLogin(request, account);
  const res = await request.put(`${API_URL}/api/auth/me/preferred-language`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { preferredLanguage },
  });
  if (!res.ok()) {
    throw new Error(
      `Self-heal: PUT /api/auth/me/preferred-language for ${account.email} failed: ` +
        `${res.status()} ${await res.text()}`,
    );
  }
}

/**
 * Logs in through the real auth dialog (header "Log in" button). Mirrors the
 * mocked-tier flow in auth.spec.ts, but against the real API.
 *
 * Shares `tokenCache` (see its doc above `apiLogin`) with every other login
 * path: the FIRST call for a given account in a run drives the real dialog
 * (fill, submit, wait for the hydration-driven close) exactly as before and
 * caches the resulting token. Every later call for that same account, this
 * run, from any spec file, instead seeds the cached token straight into
 * `localStorage` and reloads — the app's own bootstrap (`authInitStarted` in
 * `auth.effects.ts`) picks it up and hydrates via `GET /api/auth/me`, which
 * is NOT covered by `AuthPolicy` (only POST /login and /register are — see
 * `AuthController.cs`), so this path spends none of the shared login budget.
 * The resulting session is real and fully hydrated either way; only a
 * redundant re-submission of the password form is skipped.
 */
export async function loginViaDialog(page: Page, account: Credentials): Promise<void> {
  const cached = tokenCache.get(account.email);
  if (cached && Date.now() - cached.loggedInAt < TOKEN_TTL_MS) {
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('auth_token', token), cached.token);
    const [meResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/api/auth/me') && res.request().method() === 'GET',
      ),
      page.reload(),
    ]);
    expect(
      meResponse.ok(),
      `session hydration from cached token failed for ${account.email}: ${meResponse.status()}`,
    ).toBe(true);
    return;
  }

  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).click();

  const form = page.locator('form.auth-form');
  await form.locator('input.uii-native').nth(0).fill(account.email);
  await form.locator('input.uii-native').nth(1).fill(account.password);
  await form.locator('button[type="submit"]').click();

  // The dialog closes once /auth/me hydrates the session — the real API round
  // trip (BCrypt verify + JWT) is why this timeout is explicit.
  await expect(form).toBeHidden({ timeout: 20_000 });

  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (token) tokenCache.set(account.email, { token, loggedInAt: Date.now() });
}
