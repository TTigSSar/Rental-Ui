import { execFileSync } from 'node:child_process';
import * as path from 'node:path';

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
  /**
   * The deliberately spare account (`DevelopmentSeedCredentials.SecondUserEmail`) — no other
   * real spec touches it (grep the other files under `e2e/real/` before adding a new
   * dependency). Reserved for journeys that must MUTATE the account's own credential, such as
   * `change-password.spec.ts`, where reusing `owner`/`renter`/`admin` would risk leaving a
   * password change behind for every other spec's `loginViaDialog`/`apiLogin` calls to trip
   * over.
   */
  user2: { email: 'user2@rental.local', password: 'Demo1234' },
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
 * `exactLatitude`/`exactLongitude` are NO LONGER a per-listing pin.
 *
 * Under the home-point model a listing has no location of its own: it inherits
 * its OWNER's home point, and `DevelopmentSeedData.SeedListing` has no
 * Latitude/Longitude fields at all any more. These two values are therefore
 * `owner@rental.local`'s seeded home point — `DevelopmentSeedData
 * .HomePoints.Kentron` (`40.1856m, 44.5126m`), applied by
 * `DevelopmentSeedRunner` through the real `IHomePointService`, which is the
 * single writer for both the user's and every one of their listings' location
 * fields.
 *
 * They CHANGED with that rework (`40.1776, 44.5126` — 5 Republic Square — was
 * the listing's own old pin; it is now the owner's Kentron home point one
 * notch north) and they will change again for every listing of this owner at
 * once if that seeded home point ever moves. `ExpectedOwnerHomeDistrictCodes`
 * in the same file is the written-down intent (`owner@` → `kentron`), and
 * `DistrictSeedDataTests` re-checks it on every backend test run.
 *
 * `publicLatitude`/`publicLongitude` are the geohash-7 cell centroid of that
 * pair (ADR-008 as amended 2026-07-25, `GeohashSnapper.Precision = 7`) —
 * confirmed live against a freshly seeded docker stack: `40.185928,
 * 44.513168`. This is a deliberate tripwire, not a magic number: it is the
 * actual centroid of the geohash-7 cell containing the exact point, rounded
 * to 6dp the same way `GeohashSnapper` does (`MidpointRounding.AwayFromZero`).
 * If `GeohashSnapper.Precision` ever changes again, recompute these two values
 * and update the ADR-008 amendment note alongside them — don't hand-wave a new
 * number in.
 *
 * Determinism note: the derivation now runs in the dev seed itself rather than
 * in `ListingLocationBackfillExtensions` (which still runs unconditionally on
 * every API startup, but now reports "0 candidates" on a seeded DB because the
 * seed already placed every listing on its owner's point). Either way the
 * fuzzed public pair is derived from a fixed exact pair by fixed code, so it
 * never drifts between runs.
 */
export const TOY_KITCHEN = {
  id: '77777777-0007-4000-9000-000000000007',
  title: 'Wooden Toy Kitchen Set',
  pricePerDay: 3_500,
  exactLatitude: 40.1856,
  exactLongitude: 44.5126,
  publicLatitude: 40.185928,
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
 * Fixed coordinates for the home-point journeys (`real/home-point-journey.spec.ts`).
 *
 * Every one of these is a CONSTANT, not a value read off a panned map: the
 * properties under test — "the snapped public pair differs from the exact
 * one", "the district changed", "this write is refused" — are all properties
 * of a specific coordinate, and a drag-derived coordinate can satisfy or
 * violate any of them by accident. In particular:
 *
 *  - a geohash-7 cell is ~153m across, so a pin that happens to land near its
 *    own cell centroid produces a public pair almost equal to the exact one —
 *    which would make a "the public pair must differ" assertion flap rather
 *    than fail honestly (this is the same reason `map-pins-privacy.spec.ts`
 *    asserts equality with a known centroid instead of a per-axis distance);
 *  - a home-point move only emits the `Pickup` notification when the public
 *    pair OR the district actually changed (`HomePointService
 *    .SetHomePointAsync`), so the "renter gets notified" assertion needs a
 *    target that is guaranteed to be a different cell AND a different
 *    district, not merely "somewhere else".
 */
export const HOME_POINTS = {
  /**
   * `owner@rental.local`'s seeded home point (`DevelopmentSeedData.HomePoints
   * .Kentron`) — reused as the journey's first deliberate point so the public
   * pair and district it derives to are already written down and verified
   * (see TOY_KITCHEN above, same numbers, same derivation).
   */
  kentron: {
    latitude: 40.1856,
    longitude: 44.5126,
    publicLatitude: 40.185928,
    publicLongitude: 44.513168,
    districtCode: 'kentron',
  },
  /**
   * `DevelopmentSeedData.HomePoints.NorNork` — the MOVE target. ~5km from the
   * Kentron point above, which puts it in a different geohash-7 cell and a
   * different district by a wide margin, so both notification triggers fire
   * and neither assertion depends on a borderline.
   */
  norNork: {
    latitude: 40.1885,
    longitude: 44.5682,
    districtCode: 'nor-nork',
  },
  /**
   * Gyumri's central square — inside Armenia, far outside all 12 Yerevan
   * districts. `GET /api/districts/at` answers `{"district": null}` here
   * (confirmed live), which is exactly the condition
   * `IHomePointService.ValidateForSave` refuses with
   * `auth.home_point_outside_yerevan`.
   *
   * Deliberately a real place in the country rather than mid-ocean: the rule
   * being tested is "Yerevan only", not "a plausible coordinate only", and an
   * absurd coordinate could pass a WGS84 range check and still fail for the
   * wrong reason.
   */
  outsideYerevan: {
    latitude: 40.7894,
    longitude: 43.8475,
  },
} as const;

/** `auth.home_point_outside_yerevan` — HomePointErrorCodes.OutsideYerevan. */
export const HOME_POINT_OUTSIDE_YEREVAN = 'auth.home_point_outside_yerevan';
/** `listing.home_point_required` — ListingsOwnerService.ErrorCodes.HomePointRequired. */
export const LISTING_HOME_POINT_REQUIRED = 'listing.home_point_required';

const DOCKER_COMPOSE_FILE = path.resolve(__dirname, '../../../rental-api/docker-compose.yml');

/**
 * Runs one statement against the docker stack's SQL Server, as `sa`, and
 * returns stdout.
 *
 * This is the ONLY escape hatch in the real tier that bypasses the API, and it
 * exists for exactly one class of fixture: a row the API can no longer
 * produce. The home-point rule is Yerevan-only for every NEW write, but
 * pre-existing rows are deliberately never retro-validated (M-038) — the
 * `AddUserHomePoint` migration derived home points from existing listings
 * without applying a rule that did not exist yet, so an owner whose stored
 * point is outside Yerevan is a real, supported state that must keep working
 * (edit, archive, restore). There is no sequence of API calls that can create
 * such a row, so "legacy owner keeps working" is untestable through the API
 * alone — and it is precisely the kind of promise that quietly stops being
 * true.
 *
 * Rules for using it:
 *  - write only to rows the calling spec created itself (a throwaway
 *    registered account), never to a seeded demo account other specs rely on;
 *  - it is a FIXTURE tool, never an assertion tool — assert through the API,
 *    so what is proven is what a real client sees.
 *
 * Invoked through `execFileSync` with an argv array rather than a shell
 * string: a shell would mangle the absolute container paths on Windows
 * (Git Bash rewrites `/opt/...` into `C:/Program Files/Git/opt/...`) and
 * would need quoting for the password's `#`.
 */
export function runDockerDbSql(sql: string): string {
  const args = [
    'compose',
    '-f',
    DOCKER_COMPOSE_FILE,
    'exec',
    '-T',
    'db',
    '/opt/mssql-tools18/bin/sqlcmd',
    '-S',
    'localhost',
    '-U',
    'sa',
    '-P',
    'RentalPlatform_SA#1',
    // -C trusts the container's self-signed cert (mssql-tools18 verifies by
    // default); -b makes a SQL error a non-zero exit so a broken fixture
    // throws here instead of silently doing nothing.
    '-C',
    '-b',
    // -I = SET QUOTED_IDENTIFIER ON. Not optional and not cosmetic: sqlcmd
    // defaults it OFF, and SQL Server refuses any INSERT/UPDATE/DELETE on a
    // table carrying a filtered index while it is off ("UPDATE failed because
    // the following SET options have incorrect settings: 'QUOTED_IDENTIFIER'"
    // — Msg 1934). `Users` has one (see UserConfiguration), so without this
    // every write through this helper fails with an error that reads like a
    // permissions or syntax problem.
    '-I',
    '-d',
    'RentalPlatformDb',
    '-h',
    '-1',
    '-W',
    '-Q',
    `SET NOCOUNT ON; ${sql}`,
  ];

  try {
    return execFileSync('docker', args, { encoding: 'utf8' }).trim();
  } catch (error) {
    // sqlcmd reports SQL errors on STDOUT, not stderr, and execFileSync's own
    // message is just the command line — so the actual cause is invisible
    // unless it is pulled out of the error object by hand.
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    throw new Error(
      `Fixture SQL failed (exit ${failure.status}) for: ${sql}\n` +
        `sqlcmd stdout: ${failure.stdout?.trim() || '(none)'}\n` +
        `sqlcmd stderr: ${failure.stderr?.trim() || '(none)'}`,
    );
  }
}

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
 * partitioned by remote IP — see `RateLimiterExtensions.cs`). Playwright
 * traffic reaches the docker API as TWO client IPs, not one — Node-side
 * calls to :8080 and browser traffic through the UI container's nginx (see
 * `AUTH_BUCKET_BY_EMAIL` below for the measurement) — so there are two 5/min
 * buckets, and each one is shared by the ENTIRE `--project=real` run rather
 * than being per spec file.
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
 * The real tier has TWO independent `auth` rate-limit buckets, not one.
 *
 * `AuthPolicy` is a fixed window of 5/minute partitioned by
 * `context.Connection.RemoteIpAddress` (`RateLimiterExtensions.ResolveClientKey`), and
 * `ForwardedHeaders` is NOT enabled in `rental-api/docker-compose.yml` — nginx only sets
 * `X-Real-IP`, which nothing reads. So the API sees two different client IPs depending on how a
 * request reached it:
 *
 *  - **`direct`** — a Node-side `APIRequestContext` call straight to `API_URL` (:8080, the
 *    host-mapped API port). The API sees the host loopback address.
 *  - **`proxied`** — anything that goes through the docker UI on `UI_URL` (:4200) and nginx's
 *    `location /api/` `proxy_pass`. The API sees the **UI container's** address. Every
 *    browser-originated request in this tier is on this side, because the docker UI bundle is
 *    same-origin (`environment.prod.ts` `apiBaseUrl: ''`).
 *
 * Measured directly against the running stack (2026-10-05): five `POST /api/auth/login` calls to
 * :8080 exhausted that bucket (6th → 429) while the very next login through :4200 still returned
 * 200, and then a second one after it. Two buckets, 5 each, 10 in total per minute.
 *
 * M-044 and `e2e/README.md` previously accounted for ONE shared 5/min bucket, which both
 * understated the suite's capacity and hid a real hazard: WHICH bucket an account's single cached
 * login spends depended on which call site happened to warm the cache first. `owner@` in
 * particular was warmed either by `releaseListingForRenter`'s self-heal (`direct`, and only when
 * a previous run had left a booking behind) or by `loginViaDialog` (`proxied`) — so the suite's
 * per-bucket demand changed with the contents of the dev DB, and the `direct` side could land on
 * 5 of 5 with zero headroom.
 *
 * This table removes that: it fixes, in ONE place, which bucket each account's one login spends.
 * The rule is "a Node-side helper login spends the same bucket that account's own UI login
 * would", so cache-warming order cannot move the budget any more:
 *
 *  - every account that signs in through the real dialog somewhere in this tier → `proxied`;
 *  - an account that only ever logs in Node-side (`admin@` — no real spec drives the admin
 *    through the login dialog) → `direct`, which is where the suite keeps its slack;
 *  - anything not listed (a throwaway account a spec registers for itself) → `direct`.
 *
 * Full per-run budget, and why it fits — see `e2e/README.md`'s "Real-tier rate-limit budgets".
 */
export type AuthBucket = 'direct' | 'proxied';

const AUTH_BUCKET_BY_EMAIL: Readonly<Record<string, AuthBucket>> = {
  // booking-lifecycle.spec.ts + create-listing-photo-upload.spec.ts sign this account in
  // through the real dialog; releaseListingForRenter may also need it Node-side.
  [ACCOUNTS.owner.email]: 'proxied',
  // booking-lifecycle.spec.ts + language-persistence.spec.ts sign this account in through the
  // real dialog; apiSetPreferredLanguage warms it Node-side first in a full run.
  [ACCOUNTS.renter.email]: 'proxied',
  // change-password.spec.ts signs this account in through the real dialog.
  [ACCOUNTS.user2.email]: 'proxied',
  // Never driven through the login dialog by any real spec — a pure helper login.
  [ACCOUNTS.admin.email]: 'direct',
};

/** The origin a Node-side auth call for this account must use — see `AUTH_BUCKET_BY_EMAIL`. */
export function authOriginFor(email: string): string {
  return (AUTH_BUCKET_BY_EMAIL[email] ?? 'direct') === 'proxied' ? UI_URL : API_URL;
}

/**
 * Per-run tally of the two `auth` buckets, printed only with `E2E_AUTH_DEBUG=1`.
 *
 * The budget in `e2e/README.md` has been re-derived by hand twice now (M-044, then again when
 * this file's journey count grew), and each time the hand count was wrong in a way that only
 * surfaced as a 429 in an unrelated spec. This makes it measurable instead: run
 * `E2E_AUTH_DEBUG=1 npx playwright test --project=real` and every real auth call prints its
 * bucket and the running total for that bucket, so the README's numbers can be checked rather
 * than argued about. Off by default so green runs stay quiet.
 */
const authSpend: Record<AuthBucket, number> = { direct: 0, proxied: 0 };

export function noteAuthSpend(bucket: AuthBucket, what: string): void {
  authSpend[bucket] += 1;
  if (process.env['E2E_AUTH_DEBUG']) {
    // eslint-disable-next-line no-console
    console.log(`[auth-budget] ${bucket} #${authSpend[bucket]}/5 — ${what}`);
  }
}

/**
 * Self-diagnosis for the shared login budget (M-044, amended 2026-09-26 for suite growth — see
 * `e2e/README.md`'s "Real-tier login budget" section and the M-044 entry in
 * `knowledge/mistakes.md`).
 *
 * A 429 on `POST /api/auth/login` here means the suite's OWN demand (~6 real logins/full run)
 * outran `AuthController`'s `auth` policy (5/minute, one shared IP-partitioned bucket for the
 * whole run — see `RateLimiterExtensions.cs`), almost always because this is the second (or
 * later) full `--project=real` run inside the same ~60s fixed window. Without this check, that
 * shows up as a generic timeout or a wrong-looking assertion failure in whichever spec happened
 * to need a login next — e.g. a booking-lifecycle CTA that "never becomes clickable" because the
 * session never hydrated — which is exactly the shape of bug M-044 already spent a full
 * investigation diagnosing once. Failing loudly HERE, naming the real cause, is meant to make
 * sure nobody re-diagnoses it a third time.
 */
export function assertLoginNotRateLimited(status: number, email: string): void {
  if (status !== 429) return;
  throw new Error(
    `Real-stack auth budget exhausted while authenticating ${email} (429 from the auth ` +
      `endpoint). This is NOT a flake and NOT a code regression: AuthController's "auth" ` +
      `rate-limit policy (login AND register) allows 5 calls/minute per client IP, and the real ` +
      `tier has TWO such buckets — "direct" (Node-side calls to :8080) and "proxied" ` +
      `(everything through the docker UI on :4200, which the API sees as the nginx container's ` +
      `IP). One full "npx playwright test --project=real" run spends 4 of 5 in EACH bucket ` +
      `(M-044, re-measured 2026-10-05 — see AUTH_BUCKET_BY_EMAIL in this file and ` +
      `e2e/README.md's "Real-tier rate-limit budgets"), so a single run fits and a second one ` +
      `started inside the same ~60s fixed window does not. Fix: wait ~60 seconds for the window ` +
      `to clear, then re-run — do not retry immediately and do not add sleeps/retries to code ` +
      `around this. Run with E2E_AUTH_DEBUG=1 to print every auth call and its bucket if the ` +
      `suite's demand itself looks wrong.`,
  );
}

/**
 * Self-diagnosis for the OTHER shared budget a real-tier spec can lean on:
 * `PUT /api/auth/me/password`'s own `password-change` rate-limit policy (5/minute, ALSO
 * partitioned by remote IP — see `RateLimiterExtensions.cs` — but a bucket entirely separate
 * from `auth`, which is exactly why a spec that needs to restore/verify a mutated credential
 * routes through this endpoint instead of spending more of the scarce login budget).
 *
 * A 429 here does NOT mean the call it guarded failed its own check (e.g. "restore did not take
 * effect") — it means that call never ran at all, so whatever it was meant to prove is UNKNOWN,
 * not disproven. Callers must check this BEFORE asserting on the response, or a rate limit gets
 * misreported as a real failure of the thing being tested.
 *
 * Critically, even the worst case here is self-healing: `DevelopmentSeedRunner` re-hashes every
 * demo account's password back to `DevelopmentSeedCredentials.Password` (`Demo1234`) on every API
 * startup, whenever the stored hash no longer matches it. So if a restore genuinely never
 * completed and a demo account is left on a temporary password, the next `docker compose ...
 * restart api` (or any redeploy) fixes it with no manual DB work — this is the fact a scary-
 * looking 429 in a `finally` block most needs to carry, so it doesn't read as data loss.
 */
export function assertPasswordChangeNotRateLimited(status: number, email: string, step: string): void {
  if (status !== 429) return;
  throw new Error(
    `Real-stack password-change budget exhausted while ${step} for ${email} (429 from ` +
      `PUT /api/auth/me/password). This does NOT mean the restore failed — it means this call ` +
      `never ran, so ${email}'s current password is UNKNOWN rather than confirmed wrong. ` +
      `AuthController's "password-change" rate-limit policy allows 5/minute for the WHOLE ` +
      `real-tier run (one shared client IP, a bucket separate from "auth" — ` +
      `RateLimiterExtensions.cs). Self-heal: even if ${email} is genuinely still on a temporary ` +
      `password, DevelopmentSeedRunner resets every demo account's password hash back to ` +
      `Demo1234 on the next API startup whenever it no longer matches — restart the docker ` +
      `"api" service (or redeploy) to restore it, no manual DB fix needed. Otherwise: wait ~60 ` +
      `seconds for the fixed window to clear and re-run. See e2e/README.md's "Real-tier login ` +
      `budget" section.`,
  );
}

/**
 * Logs in through the real API and returns the JWT, reusing a cached token
 * for the same account when one is still fresh (see `tokenCache` doc above).
 */
export async function apiLogin(request: APIRequestContext, account: Credentials): Promise<string> {
  const cached = tokenCache.get(account.email);
  if (cached && Date.now() - cached.loggedInAt < TOKEN_TTL_MS) {
    return cached.token;
  }

  // The origin decides WHICH of the two 5/min `auth` buckets this login spends — see
  // AUTH_BUCKET_BY_EMAIL. It is a per-account constant, deliberately not a per-call-site choice:
  // whichever helper or spec warms an account's token first, it costs the same bucket.
  const origin = authOriginFor(account.email);
  noteAuthSpend(origin === UI_URL ? 'proxied' : 'direct', `apiLogin ${account.email}`);
  const res = await request.post(`${origin}/api/auth/login`, { data: account });
  assertLoginNotRateLimited(res.status(), account.email);
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

export interface RegistrationDetails {
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly email: string;
  readonly password: string;
}

/**
 * Registers a THROWAWAY account through the real API and returns its JWT (the register response
 * already carries one, so this costs exactly one `auth` call, not a register plus a login).
 *
 * This exists so a journey whose subject is *mutating a user* can own its own account instead of
 * mutating a seeded one. The seeded demo accounts are shared, the dev DB is persistent, and
 * anything a spec accumulates on a shared account becomes a hidden input to every other spec's
 * assertions — which is exactly how the home-point journey's notification assertion rotted: it
 * counted `Pickup` rows inside a cursor-paginated 20-item window on `renter@`, and once that
 * account had crossed 20 notifications a newly emitted one pushed an older one off the bottom
 * instead of changing the in-page count.
 *
 * The account is deliberately NOT deleted afterwards: it owns nothing visible once the calling
 * spec archives its listings, and deleting a user with bookings and notifications means
 * hand-walking FK cascades for no regression value.
 *
 * Budget: `POST /api/auth/register` shares the `auth` bucket with login and is structurally
 * uncacheable (the account does not exist yet). An unlisted email resolves to the `direct` bucket
 * (see `AUTH_BUCKET_BY_EMAIL`), which is where this tier keeps its slack.
 */
export async function apiRegister(
  request: APIRequestContext,
  details: RegistrationDetails,
): Promise<string> {
  const origin = authOriginFor(details.email);
  noteAuthSpend(origin === UI_URL ? 'proxied' : 'direct', `apiRegister ${details.email}`);
  const res = await request.post(`${origin}/api/auth/register`, {
    data: {
      firstName: details.firstName,
      lastName: details.lastName,
      phoneNumber: details.phone,
      email: details.email,
      password: details.password,
    },
    failOnStatusCode: false,
  });
  assertLoginNotRateLimited(res.status(), details.email);
  if (!res.ok()) {
    throw new Error(
      `API register failed for ${details.email}: ${res.status()} ${await res.text()}`,
    );
  }
  const body = (await res.json()) as { token?: string; accessToken?: string };
  const token = body.accessToken ?? body.token;
  if (!token) throw new Error(`API register for ${details.email} returned no token.`);
  tokenCache.set(details.email, { token, loggedInAt: Date.now() });
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
  await apiSetPreferredLanguageForToken(request, token, preferredLanguage, account.email);
}

/**
 * Same PUT, for a session whose token is already in hand — a throwaway account a spec registered
 * itself (see `apiRegister`), which has no reason to spend an `auth` call signing in again. It is
 * also the honest shape for such an account: nothing needs restoring afterwards, because nothing
 * else in the suite reads it.
 */
export async function apiSetPreferredLanguageForToken(
  request: APIRequestContext,
  token: string,
  preferredLanguage: string | null,
  label = 'the current session',
): Promise<void> {
  const res = await request.put(`${API_URL}/api/auth/me/preferred-language`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { preferredLanguage },
  });
  if (!res.ok()) {
    throw new Error(
      `PUT /api/auth/me/preferred-language for ${label} failed: ` +
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

  // Browser-originated, so it reaches the API through nginx: the `proxied` bucket, never the
  // `direct` one (see AUTH_BUCKET_BY_EMAIL). Every account this function is ever called with is
  // pinned to `proxied` in that table precisely so this call and a Node-side `apiLogin` for the
  // same account cannot land in different buckets depending on which ran first.
  noteAuthSpend('proxied', `loginViaDialog ${account.email}`);

  // Capture the actual POST /api/auth/login response so a 429 (shared login budget exhausted —
  // see assertLoginNotRateLimited above) fails immediately with an explicit cause instead of the
  // dialog just sitting there until the generic 20s "form never closed" timeout below, which
  // looks identical to a real app bug.
  const [loginRes] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST',
    ),
    form.locator('button[type="submit"]').click(),
  ]);
  assertLoginNotRateLimited(loginRes.status(), account.email);

  // The dialog closes once /auth/me hydrates the session — the real API round
  // trip (BCrypt verify + JWT) is why this timeout is explicit.
  await expect(form).toBeHidden({ timeout: 20_000 });

  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  if (token) tokenCache.set(account.email, { token, loggedInAt: Date.now() });
}
