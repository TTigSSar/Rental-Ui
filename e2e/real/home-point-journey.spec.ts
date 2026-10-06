import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  ACCOUNTS,
  API_URL,
  HOME_POINTS,
  HOME_POINT_OUTSIDE_YEREVAN,
  LISTING_HOME_POINT_REQUIRED,
  apiLogin,
  apiRegister,
  apiSetPreferredLanguageForToken,
  assertDockerStack,
  assertLoginNotRateLimited,
  noteAuthSpend,
  runDockerDbSql,
} from '../support/real-stack';
import { STUB_PNG_BUFFER } from '../support/stub-image';

/**
 * The home-point model, end to end on the real stack.
 *
 * ONE home point per user; EVERY listing that user owns inherits it; moving it
 * relocates all of them at once and notifies the renters already holding a
 * booking. The five fields a listing used to carry (latitude, longitude,
 * districtId, city, country) are gone from `CreateListingRequest` entirely.
 *
 * Why this has to be a real-stack spec, not (only) unit + mocked coverage —
 * each of these is a property that every cheaper layer structurally cannot
 * see:
 *
 *  - **The derivation chain is three real services deep.** A saved point is
 *    snapped by `GeohashSnapper` (precision 7) and resolved against the OSM
 *    district polygon asset by `DistrictBoundaryProvider`, and the result is
 *    written to the user AND copied onto every listing row. The backend tests
 *    run that chain on SQLite; the mocked e2e tier never runs it at all
 *    (`api-mock.ts` returns a hand-written `homePoint` object). "The public
 *    pair differs from the exact one, and both land on the real
 *    `decimal(9,6)` columns" is only true or false on the real stack.
 *  - **The fan-out is a multi-row write nothing else exercises.** The single
 *    most expensive thing to break here is "the owner moved and one listing
 *    stayed behind" — a stale pin on the public map, pointing renters at an
 *    address the owner left. That is a `SaveChangesAsync` over N rows of real
 *    SQL Server, plus a best-effort notification pass that is deliberately
 *    wrapped in `catch {}` (`HomePointService.SetHomePointAsync`) — so a
 *    failure in it is SILENT by design. Silent-by-design is exactly what
 *    needs an automated witness.
 *  - **The privacy gate is a negative over a whole payload.** ADR-008 says
 *    the exact point never leaves the owner's own `CurrentUserResponse`. The
 *    xUnit privacy tests prove individual service methods don't return it;
 *    only a real anonymous HTTP call proves the deployed routes don't
 *    (M-017 / `map-pins-privacy.spec.ts` has the full argument).
 *  - **M-038's legacy row cannot be produced by the API at all.** A home
 *    point outside Yerevan is refused for every new write, but rows the
 *    `AddUserHomePoint` migration derived from pre-existing out-of-town
 *    listings keep working on purpose. The only way to witness that promise
 *    is to construct the row in the DB (see `runDockerDbSql`) and then drive
 *    the real API against it.
 *
 * Shape: one journey test for the ordered story (register → publish → privacy
 * → move → notify → legacy), because every step consumes the previous step's
 * server state, and two small independent tests for the two refusals, which
 * need no shared state. No spec-level ordering dependence either way — a
 * single test with steps is the pattern the rest of this tier uses
 * (`booking-lifecycle`, `map-pins-privacy`) precisely so "tests must not
 * depend on execution order" stays literally true.
 *
 * Auth budget (`AuthPolicy`: 5/minute per client IP, and the real tier has
 * TWO such buckets — `direct` for Node-side calls to :8080 and `proxied` for
 * everything through the docker UI's nginx; see `AUTH_BUCKET_BY_EMAIL` in
 * support/real-stack.ts): this file spends TWO uncacheable auth calls, both
 * registers, because `POST /api/auth/register` shares the `auth` bucket with
 * login and cannot be cached — the account does not exist yet.
 *
 *  - the throwaway OWNER's sign-up, issued by the browser → `proxied`;
 *  - this run's throwaway RENTER, issued Node-side → `direct`.
 *
 * Everything else reuses `real-stack.ts`'s per-account token cache: `admin@`
 * and `user2@` are accounts other real specs already sign in as, and `renter@`
 * is only needed by the third test in this file. In a full `--project=real`
 * run this file therefore adds +1 to each bucket. Run SOLO it pays for its own
 * `admin@`/`user2@`/`renter@` logins too, which still fits one run per bucket
 * but not two back-to-back: wait ~60s between solo runs.
 *
 * Determinism:
 *  - Every coordinate is a fixed constant from `HOME_POINTS`, never a value
 *    read off a dragged map — see that export's doc comment for why a
 *    drag-derived coordinate would make the "public pair differs" and "the
 *    district changed" assertions flap instead of fail honestly. The one
 *    drag in this spec (the sign-up step's map) is asserted only for the
 *    property a drag CAN prove deterministically: the pair the client sent
 *    is the pair the server stored.
 *  - The owner is registered fresh per run under a timestamped email, so no
 *    assertion here can be perturbed by, or perturb, a seeded demo account.
 *    Its listings are archived in `afterEach` and its booking cancelled, so
 *    nothing it created can leak into `listings-search-filter.spec.ts`'s
 *    counts or the public catalogue. The account row itself is left behind
 *    (deleting a user with bookings and notifications means hand-walking FK
 *    cascades, which is more risk than the row is worth) — it owns nothing
 *    visible once cleanup runs.
 *  - The RENTER is registered fresh per run too, and left on `ru` forever
 *    (nothing else reads it). This journey used to borrow `renter@`, switch it
 *    to Russian to prove the notification copy is rendered per-recipient at
 *    emit time, and restore English in a `finally` — a restore a hard-killed
 *    run skips, and a borrowed account whose accumulated notifications then
 *    became a hidden input to the assertion. Both problems are gone with the
 *    account: a renter registered by this run holds zero notifications, so
 *    "the move emitted exactly ONE Pickup" is an absolute count that the
 *    persistent dev DB cannot perturb (see `qaRenter` below, and
 *    `getAllNotifications` for the paging defect this replaced).
 */

interface DistrictPayload {
  readonly id: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameHy: string;
  readonly nameRu: string;
}

interface HomePointPayload {
  readonly latitude: number;
  readonly longitude: number;
  readonly publicLatitude: number | null;
  readonly publicLongitude: number | null;
  readonly district: DistrictPayload | null;
  readonly updatedAt: string | null;
}

interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly homePoint: HomePointPayload | null;
}

interface ListingDetails {
  readonly id: string;
  readonly title: string;
  readonly city: string;
  readonly country: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly district: DistrictPayload | null;
}

interface MyListing {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly city: string;
}

interface MapPin {
  readonly id: string;
  readonly latitude: number;
  readonly longitude: number;
}

interface NotificationItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly toy: { readonly title: string } | null;
  readonly primaryAction: { readonly label: string; readonly deepLink: string } | null;
}

interface ProblemDetailsBody {
  readonly errorCode?: string;
  readonly type?: string;
  readonly title?: string;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function getCurrentUser(request: APIRequestContext, token: string): Promise<CurrentUser> {
  const res = await request.get(`${API_URL}/api/auth/me`, { headers: bearer(token) });
  expect(res.ok(), `GET /api/auth/me must succeed (${res.status()})`).toBe(true);
  return (await res.json()) as CurrentUser;
}

async function getListingAsOwner(
  request: APIRequestContext,
  token: string,
  listingId: string,
): Promise<ListingDetails> {
  const res = await request.get(`${API_URL}/api/listings/${listingId}`, { headers: bearer(token) });
  expect(res.ok(), `GET /api/listings/${listingId} as owner must succeed (${res.status()})`).toBe(
    true,
  );
  return (await res.json()) as ListingDetails;
}

async function getMyListings(request: APIRequestContext, token: string): Promise<MyListing[]> {
  const res = await request.get(`${API_URL}/api/listings/mine`, { headers: bearer(token) });
  expect(res.ok(), `GET /api/listings/mine must succeed (${res.status()})`).toBe(true);
  return (await res.json()) as MyListing[];
}

/**
 * Reads the recipient's WHOLE notification feed, following `nextCursor` to the end.
 *
 * `GET /api/notifications` is cursor-paginated at 20 items (`NotificationsService.PageSize`), and
 * a single unpaged call answers only the newest 20. Counting anything inside that window is
 * unsound against an account that accumulates: when a new row lands at the top an older one drops
 * off the bottom, so the in-page count of a kind can stay flat while the real count grows. That
 * is not a hypothetical — it is how this spec's own `Pickup` assertion started failing
 * deterministically (`Expected: 9, Received: 8`) once `renter@rental.local` had crossed 20
 * notifications in the persistent dev DB: 11 `Pickup` rows existed, 8 were visible, and the 9th
 * emission pushed an older item out of the window instead of changing the count. The app was
 * right and the test was wrong.
 *
 * `counts.all` is the feed's own total over the whole table (`NotificationsStore.GetCountsAsync`),
 * so comparing it against the number of items actually walked is a self-check that the walk saw
 * everything — if the two ever disagree, this helper is reading a partial feed again and says so
 * instead of quietly under-counting.
 */
async function getAllNotifications(
  request: APIRequestContext,
  token: string,
): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  let cursor: string | null = null;
  let countsAll = 0;

  // A hard bound rather than `while (true)`: a server that returned a non-advancing cursor would
  // otherwise hang the spec until the 180s test timeout, which reads like an app deadlock.
  for (let page = 0; page < 50; page += 1) {
    const url = cursor
      ? `${API_URL}/api/notifications?cursor=${encodeURIComponent(cursor)}`
      : `${API_URL}/api/notifications`;
    const res = await request.get(url, { headers: bearer(token) });
    expect(res.ok(), `GET /api/notifications must succeed (${res.status()})`).toBe(true);
    const body = (await res.json()) as {
      items: NotificationItem[];
      nextCursor: string | null;
      counts: { all: number };
    };
    items.push(...body.items);
    countsAll = body.counts.all;
    cursor = body.nextCursor ?? null;
    if (!cursor) {
      expect(
        items.length,
        'the walked feed must contain exactly as many items as the feed reports in counts.all — ' +
          'a mismatch means this helper is reading a PARTIAL feed, which is the defect it exists ' +
          'to prevent (see its doc comment), not a reason to relax the count below',
      ).toBe(countsAll);
      return items;
    }
  }

  throw new Error(
    `GET /api/notifications did not terminate within 50 pages (${items.length} items read, ` +
      `counts.all=${countsAll}) — the cursor is not advancing.`,
  );
}

/** The stable machine-readable code, whichever shape the ProblemDetails took. */
function errorCodeOf(body: ProblemDetailsBody): string | undefined {
  return body.errorCode ?? body.type?.replace(/^urn:rental:error:/, '');
}

/**
 * `NotificationKind.Pickup`, as it arrives on the wire.
 *
 * Case-insensitive on purpose, and verified against the live API: the feed
 * serializes the enum through the app's camelCase naming policy, so
 * `NotificationKind.Pickup` reaches the client as `"pickup"`, not `"Pickup"`.
 * Matching the C# member name exactly looks right, compiles, and silently
 * matches nothing — which in this spec read as "the notification was never
 * emitted" while the row sat in the database all along.
 */
function isPickup(notification: NotificationItem): boolean {
  return notification.kind.toLowerCase() === 'pickup';
}

/**
 * Fills sign-up step 1 and crosses into the home-point step. Mirrors the
 * mocked tier's `auth-register-home.spec.ts` (same dialog, same field order),
 * including its reason for waiting on the field COUNT before addressing
 * inputs by index: login has 2 `input.uii-native`, register has 5, and a fill
 * issued before the swap lands in the login form and is thrown away with it.
 */
async function fillSignUpStepOne(
  page: Page,
  details: { firstName: string; lastName: string; phone: string; email: string; password: string },
): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('tab', { name: 'Create account' }).click();

  const inputs = page.locator('form.auth-form input.uii-native');
  await expect(inputs).toHaveCount(5);
  await inputs.nth(0).fill(details.firstName);
  await inputs.nth(1).fill(details.lastName);
  await inputs.nth(2).fill(details.phone);
  await inputs.nth(3).fill(details.email);
  await inputs.nth(4).fill(details.password);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('app-home-point-map')).toBeVisible();
}

/**
 * Pans the sign-up map a deliberate ~900m east of its opening centre
 * (Republic Square) and waits for the district chip to RESOLVE before
 * returning.
 *
 * The wait is the load-bearing part, not politeness. Two confirmed defects
 * live exactly here: Leaflet fires `moveend` after its own inertia, so a
 * submit issued the instant the mouse comes up can read the pre-pan centre
 * and send a stale coordinate; and the district readout is a real round trip
 * to `GET /api/districts/at`. `.hp-map__chip--ok` is the component's own
 * "this is a deliberate point AND its district has resolved" state (see
 * `home-point-map.component.html`), which is the earliest moment the value
 * the form holds is the value the user chose.
 *
 * 60px, horizontal only: a purely sideways drag cannot wander outside the
 * element's own box the way a diagonal one can, and at the picker's opening
 * zoom (13) 60px is ~900m — far enough to be a different geohash-7 cell
 * (~153m) by a wide margin, and nowhere near far enough to leave Kentron
 * (its nearest boundary in that direction is ~2km out; verified against the
 * live `/api/districts/at`).
 */
async function panSignUpMapAndWaitForDistrict(page: Page): Promise<void> {
  const surface = page.locator('app-home-point-map .app-map__surface');
  // `leaflet-container` is the class Leaflet adds once it owns the element.
  // Before that, mouse events land on a plain div and pan nothing — which
  // reads as "the button never enables" rather than as a timing problem.
  await expect(surface).toHaveClass(/leaflet-container/);
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();

  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 10 });
  await page.mouse.up();

  await expect(
    page.locator('app-home-point-map .hp-map__chip--ok'),
    'the district chip must resolve to a real Yerevan district before the point is submitted — ' +
      'an unresolved chip means either the pan was swallowed or GET /api/districts/at failed',
  ).toBeVisible();
}

/** Runs the create-listing wizard to its final step. Location is no longer collected anywhere in it. */
async function completeListingWizard(page: Page, title: string): Promise<void> {
  await page.goto('/listings/create');

  // An owner WITH a home point goes straight into step 1; the gate is the
  // no-home-point branch and must not appear here.
  await expect(page.locator('.wizard--gate')).toBeHidden();

  // MIN_PHOTOS = 3 in create-listing-form.component.ts: with fewer, "Continue
  // to basics" silently never advances and every later step looks like a hang.
  await page.locator('#wizard-images-input').setInputFiles(
    [1, 2, 3].map((n) => ({ name: `toy-${n}.png`, mimeType: 'image/png', buffer: STUB_PNG_BUFFER })),
  );
  await page.getByRole('button', { name: 'Continue to basics' }).click();

  await page.getByLabel('Toy name').fill(title);
  await page.locator('.cs-trigger').click();
  await page.locator('.cs-option').first().click();
  await page
    .getByLabel('Description')
    .fill('QA real-stack regression fixture — proves a listing inherits its owner home point.');
  await page.getByRole('button', { name: 'Continue to pricing' }).click();

  // Step 3's location block is a READ-ONLY card now: no city input, no
  // district select, no per-listing pin picker. Asserting the card is the
  // positive half of "the five removed fields are gone" — the payload
  // assertion in the caller is the other half.
  //
  // The district text is the real payoff: "Kentron" is the district the
  // SERVER derived from the coordinate (point-in-polygon against the OSM
  // boundary asset) and handed back on `/api/auth/me`. Nothing in this wizard
  // asks for it, and no cheaper tier can produce it — the mocked tier hands
  // the component a hand-written district object.
  await expect(page.locator('app-pickup-area-card')).toBeVisible();
  await expect(page.locator('app-pickup-area-card .pickup-card__text')).toContainText('Kentron');
  await expect(page.locator('.pickup-card__city-value')).toContainText('Yerevan');
  await expect(page.locator('[formcontrolname="city"]')).toHaveCount(0);
  await expect(page.locator('#wz-district')).toHaveCount(0);

  await page.locator('#wz-price').fill('2500');
  // Loss & damage compensation is required on create (1,000–10,000,000 ֏);
  // without it step 3 silently refuses to advance.
  await page.locator('#wz-compensation').fill('30000');
  await page.getByRole('button', { name: 'Continue to safety' }).click();

  await page.getByRole('button', { name: 'Continue to preview' }).click();
}

test.describe('Home point — the single source of every listing location (real stack)', () => {
  const runId = Date.now();
  const owner = {
    firstName: 'Qa',
    lastName: 'Homepoint',
    phone: '+37491234567',
    email: `qa.home.point.${runId}@rental.local`,
    password: 'Demo1234',
  };

  /**
   * The journey's OWN renter, registered fresh per run — not `renter@rental.local`.
   *
   * The thing being asserted is "the move emitted exactly ONE Pickup notification to the renter
   * holding a booking". On a shared seeded account that is a statement about accumulated state:
   * `renter@` is a recipient of the dev seed's own home-point fan-out and of every previous
   * real-tier run's bookings, so the assertion had to be a delta — and a delta measured inside a
   * 20-item page is not a delta at all once the account crosses 20 notifications (see
   * `getAllNotifications`). A per-run renter starts at zero notifications, which makes the
   * assertion ABSOLUTE (`exactly one Pickup, full stop`) and immune to whatever the dev DB has
   * accumulated.
   *
   * It also removes the one piece of cross-spec coupling this journey used to carry: it had to
   * drive `renter@` to Russian to prove per-recipient copy rendering, then restore English in a
   * `finally` for every other spec's English locators — a restore a hard-killed run skips. A
   * throwaway renter can simply be left on `ru` forever, because nothing else reads it.
   *
   * Budget: one `POST /api/auth/register`, on the `direct` auth bucket (see
   * `AUTH_BUCKET_BY_EMAIL` in support/real-stack.ts). It replaces nothing, so it is +1 — the
   * bucket re-measurement is what makes room for it.
   */
  const qaRenter = {
    firstName: 'Qa',
    lastName: 'Homerenter',
    phone: '+37491234568',
    email: `qa.home.renter.${runId}@rental.local`,
    password: 'Demo1234',
  };

  let ownerToken: string | null = null;
  let qaRenterToken: string | null = null;
  let listingAId: string | null = null;
  let listingBId: string | null = null;
  let bookingId: string | null = null;

  test.afterEach(async ({ request }) => {
    // Best-effort, and deliberately unasserted: a failure here (most often
    // "the test failed before this thing existed") must never mask or
    // overwrite the real test result.
    if (bookingId && qaRenterToken) {
      await request.post(`${API_URL}/api/bookings/${bookingId}/cancel`, {
        headers: bearer(qaRenterToken),
        failOnStatusCode: false,
      });
    }
    if (ownerToken) {
      for (const id of [listingAId, listingBId].filter((x): x is string => !!x)) {
        // archive works from any non-Archived status, including the
        // PendingApproval a never-moderated listing sits in, and moves the
        // listing out of every status the public catalogue returns.
        await request.post(`${API_URL}/api/listings/${id}/archive`, {
          headers: bearer(ownerToken),
          failOnStatusCode: false,
        });
      }
    }
  });

  test('a new owner registers a point, publishes onto it, moves it, and takes every listing along', async ({
    page,
    request,
  }) => {
    await test.step('guard: docker stack is what is actually serving :4200/:8080', async () => {
      await assertDockerStack(request);
    });

    // ──────────────────────────────────────────────────────────────────────
    // 1. Register WITH a home point, through the real two-step sign-up.
    // ──────────────────────────────────────────────────────────────────────
    const registerBody = await test.step('sign up with a home point chosen on the map', async () => {
      await fillSignUpStepOne(page, owner);

      const createAccount = page.getByRole('button', { name: 'Create account', exact: true });
      // Disabled until the map is moved on purpose — nobody registers the
      // city centre by accident.
      await expect(createAccount).toBeDisabled();
      await panSignUpMapAndWaitForDistrict(page);
      await expect(createAccount).toBeEnabled();

      // Browser-originated, so it goes through nginx and spends the `proxied` auth bucket, not
      // the `direct` one the Node-side helpers use (see AUTH_BUCKET_BY_EMAIL in
      // support/real-stack.ts). Recorded by hand because nothing in real-stack.ts issues it.
      noteAuthSpend('proxied', `sign-up register ${owner.email}`);

      const [registerRequest, registerResponse] = await Promise.all([
        page.waitForRequest(
          (req) => req.url().endsWith('/api/auth/register') && req.method() === 'POST',
        ),
        page.waitForResponse(
          (res) => res.url().endsWith('/api/auth/register') && res.request().method() === 'POST',
        ),
        createAccount.click(),
      ]);

      // POST /register shares the `auth` rate-limit bucket with login, so a
      // 429 here is the shared-budget failure, not a broken sign-up.
      assertLoginNotRateLimited(registerResponse.status(), owner.email);
      expect(
        registerResponse.ok(),
        `POST /api/auth/register must succeed (${registerResponse.status()} ` +
          `${await registerResponse.text()})`,
      ).toBe(true);

      // Success closes the dialog — there is no later screen that could
      // collect the point, which is why it has to travel in this one request.
      await expect(page.locator('form.auth-form')).toBeHidden();

      return registerRequest.postDataJSON() as Record<string, number | string>;
    });

    ownerToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(ownerToken, 'the new session JWT must be in localStorage after sign-up').toBeTruthy();

    const registeredLatitude = Number(registerBody['homeLatitude']);
    const registeredLongitude = Number(registerBody['homeLongitude']);

    const ownerId = await test.step(
      '/auth/me returns the exact pair sent, a DIFFERENT snapped pair, and a district',
      async () => {
        const me = await getCurrentUser(request, ownerToken!);
        expect(me.email).toBe(owner.email);
        const point = me.homePoint;
        expect(point, 'a registration that carried coordinates must come back with a home point').not.toBeNull();

        // Exact pair round trip. 6dp, not full equality: the column is
        // `decimal(9,6)` and `HomePointService` rounds to match it
        // (`MidpointRounding.AwayFromZero`), while a Leaflet centre carries
        // more digits than that. This is the one assertion the drag CAN make
        // deterministically — the pair the client sent is the pair the server
        // stored.
        expect(point!.latitude, 'the exact latitude must survive the round trip').toBeCloseTo(
          registeredLatitude,
          6,
        );
        expect(point!.longitude, 'the exact longitude must survive the round trip').toBeCloseTo(
          registeredLongitude,
          6,
        );

        // The public pair is the geohash-7 cell centroid and must be a
        // DIFFERENT pair — that difference is the entire privacy mechanism.
        expect(point!.publicLatitude, 'the snapped public latitude must be derived').not.toBeNull();
        expect(point!.publicLongitude, 'the snapped public longitude must be derived').not.toBeNull();
        expect(
          { lat: point!.publicLatitude, lng: point!.publicLongitude },
          'the snapped public pair must not be the exact pair — the geohash-7 fuzz is what ' +
            'keeps an exact home address off every public surface (ADR-008)',
        ).not.toEqual({ lat: point!.latitude, lng: point!.longitude });

        // A real district resolved from the real OSM polygon asset. Not
        // pinned to a specific code: that would pin the drag geometry rather
        // than the behaviour. The deliberate, constant point set below is
        // where the code is asserted.
        expect(
          point!.district,
          'the home point must resolve to one of the 12 Yerevan districts — a null district here ' +
            'means the pan left the city, which would have been refused at save time',
        ).not.toBeNull();
        expect(point!.updatedAt, 'the home point must carry its placement timestamp').toBeTruthy();

        return me.id;
      },
    );

    // ──────────────────────────────────────────────────────────────────────
    // 2. Pin the point to a KNOWN constant, so every later assertion is
    //    about documented values rather than about where a drag landed.
    // ──────────────────────────────────────────────────────────────────────
    await test.step('move the point to the documented Kentron constant', async () => {
      const res = await request.put(`${API_URL}/api/auth/me/home-point`, {
        headers: bearer(ownerToken!),
        data: {
          latitude: HOME_POINTS.kentron.latitude,
          longitude: HOME_POINTS.kentron.longitude,
        },
      });
      expect(res.ok(), `PUT /api/auth/me/home-point must succeed (${res.status()})`).toBe(true);

      const me = await getCurrentUser(request, ownerToken!);
      const point = me.homePoint!;
      expect(point.latitude).toBeCloseTo(HOME_POINTS.kentron.latitude, 6);
      expect(point.longitude).toBeCloseTo(HOME_POINTS.kentron.longitude, 6);
      // The deliberate tripwire: these two are the literal geohash-7 cell
      // centroid of the pair above (see HOME_POINTS / TOY_KITCHEN in
      // real-stack.ts). If GeohashSnapper.Precision ever changes, this is
      // where it surfaces — recompute the constants and amend ADR-008, do
      // not loosen the assertion.
      expect(point.publicLatitude, 'snapped public latitude (geohash-7 centroid)').toBeCloseTo(
        HOME_POINTS.kentron.publicLatitude,
        6,
      );
      expect(point.publicLongitude, 'snapped public longitude (geohash-7 centroid)').toBeCloseTo(
        HOME_POINTS.kentron.publicLongitude,
        6,
      );
      expect(point.district!.code).toBe(HOME_POINTS.kentron.districtCode);
    });

    // ──────────────────────────────────────────────────────────────────────
    // 3. Publish through the real wizard. The listing must land on the
    //    owner's point, and the payload must carry none of the five fields
    //    the backend dropped.
    // ──────────────────────────────────────────────────────────────────────
    const listingATitle = `QA Home Point A ${runId}`;
    await test.step('publish listing A — step 3 is a read-only pickup area, and the create payload carries none of the five removed fields', async () => {
      // `completeListingWizard` navigates, which re-bootstraps the app and
      // re-reads `/api/auth/me` (not rate-limited), so the wizard holds the
      // point set out-of-band above rather than the one sign-up stored.

      await completeListingWizard(page, listingATitle);

      const [createRequest, createResponse] = await Promise.all([
        page.waitForRequest((req) => req.url().endsWith('/api/listings') && req.method() === 'POST'),
        page.waitForResponse(
          (res) => res.url().endsWith('/api/listings') && res.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Submit for review' }).click(),
      ]);

      expect(
        createResponse.ok(),
        `POST /api/listings must succeed (${createResponse.status()} ${await createResponse.text()})`,
      ).toBe(true);
      listingAId = ((await createResponse.json()) as { id: string }).id;

      const body = createRequest.postDataJSON() as Record<string, unknown>;
      // Re-adding any of these would typecheck, ship, and be silently
      // dropped by the serializer — accepted-looking and never applied, the
      // M-036 failure shape. This is the assertion that makes that loud.
      for (const field of ['latitude', 'longitude', 'districtId', 'city', 'country']) {
        expect(
          body,
          `the create payload must not carry "${field}" — the backend derives it from the ` +
            `owner's home point and ignores an unknown member, so a client that sends it looks ` +
            `accepted while nothing is applied`,
        ).not.toHaveProperty(field);
      }
    });

    await test.step('listing A landed on the owner home point, with city/country/district derived', async () => {
      const listing = await getListingAsOwner(request, ownerToken!, listingAId!);
      expect(listing.title).toBe(listingATitle);
      expect(Number(listing.latitude), 'listing latitude is the owner home point').toBeCloseTo(
        HOME_POINTS.kentron.latitude,
        6,
      );
      expect(Number(listing.longitude), 'listing longitude is the owner home point').toBeCloseTo(
        HOME_POINTS.kentron.longitude,
        6,
      );
      expect(listing.district!.code, 'listing district is the home district').toBe(
        HOME_POINTS.kentron.districtCode,
      );
      // Derived, not submitted — the wizard never sent either of these.
      expect(listing.city).toBe('Yerevan');
      expect(listing.country).toBe('Armenia');
    });

    await test.step('create listing B through the API so the move has a SECOND listing to carry', async () => {
      const categoriesRes = await request.get(`${API_URL}/api/categories`);
      expect(categoriesRes.ok(), 'GET /api/categories must succeed').toBe(true);
      const categories = (await categoriesRes.json()) as { id: string }[];
      expect(categories.length, 'the seed must expose at least one category').toBeGreaterThan(0);

      const res = await request.post(`${API_URL}/api/listings`, {
        headers: bearer(ownerToken!),
        data: {
          categoryId: categories[0].id,
          title: `QA Home Point B ${runId}`,
          description:
            'QA real-stack regression fixture — the second listing, so the move is proven to be a fan-out.',
          pricePerDay: 1500,
          compensationAmount: 20000,
        },
      });
      expect(res.ok(), `POST /api/listings (listing B) must succeed (${res.status()})`).toBe(true);
      listingBId = ((await res.json()) as { id: string }).id;
    });

    await test.step('admin approves listing A (a booking needs an Approved listing)', async () => {
      const adminToken = await apiLogin(request, ACCOUNTS.admin);
      const res = await request.post(`${API_URL}/api/admin/listings/${listingAId}/approve`, {
        headers: bearer(adminToken),
      });
      expect(res.ok(), `admin approve must succeed (${res.status()})`).toBe(true);
    });

    // ──────────────────────────────────────────────────────────────────────
    // 4. Privacy: no anonymous surface may carry the exact pair, and no
    //    public profile may carry home-point data at all.
    // ──────────────────────────────────────────────────────────────────────
    await test.step('the anonymous listing payload carries the snapped pair, never the exact one', async () => {
      const res = await request.get(`${API_URL}/api/listings/${listingAId}`);
      expect(res.ok(), 'an Approved listing must be readable anonymously').toBe(true);
      const listing = (await res.json()) as ListingDetails;

      // The positive, strong form: equality with the known centroid. A
      // per-axis distance check would be structurally wrong — at precision 7
      // the centroid can legitimately sit within 0.0005° of the exact point
      // on either axis (ADR-008 amendment).
      expect(Number(listing.latitude)).toBeCloseTo(HOME_POINTS.kentron.publicLatitude, 6);
      expect(Number(listing.longitude)).toBeCloseTo(HOME_POINTS.kentron.publicLongitude, 6);
      // The leak check, kept explicit even though implied above.
      expect(
        { lat: Number(listing.latitude), lng: Number(listing.longitude) },
        'the anonymous listing payload must never carry the exact home point',
      ).not.toEqual({ lat: HOME_POINTS.kentron.latitude, lng: HOME_POINTS.kentron.longitude });
    });

    await test.step('the anonymous map pin carries the snapped pair, never the exact one', async () => {
      const res = await request.get(`${API_URL}/api/listings/map-pins`);
      expect(res.ok(), 'GET /api/listings/map-pins must succeed').toBe(true);
      const { items } = (await res.json()) as { items: MapPin[] };
      const pin = items.find((p) => p.id === listingAId);
      expect(pin, 'the freshly approved listing must appear in the anonymous map-pins feed').toBeTruthy();
      expect(Number(pin!.latitude)).toBeCloseTo(HOME_POINTS.kentron.publicLatitude, 6);
      expect(Number(pin!.longitude)).toBeCloseTo(HOME_POINTS.kentron.publicLongitude, 6);
      expect(
        { lat: Number(pin!.latitude), lng: Number(pin!.longitude) },
        'a map pin must never carry the exact home point',
      ).not.toEqual({ lat: HOME_POINTS.kentron.latitude, lng: HOME_POINTS.kentron.longitude });
    });

    await test.step('the public profile carries no home-point data at all', async () => {
      const res = await request.get(`${API_URL}/api/users/${ownerId}/public-profile`);
      expect(res.ok(), 'GET /api/users/{id}/public-profile must succeed').toBe(true);
      const raw = await res.text();
      const profile = JSON.parse(raw) as Record<string, unknown>;

      // Not "the exact pair is absent" but "there is no home-point-shaped
      // field here to leak through later". `HomePointResponse` is documented
      // as self-view-only; the way that promise breaks is a convenience field
      // added to a public DTO, so the key names are what gets policed.
      const homeish = Object.keys(profile).filter((key) => /^home|homePoint/i.test(key));
      expect(
        homeish,
        `the public profile must declare no home-point field (found: ${homeish.join(', ')})`,
      ).toEqual([]);
      for (const needle of [
        String(HOME_POINTS.kentron.latitude),
        String(HOME_POINTS.kentron.longitude),
      ]) {
        expect(
          raw,
          `the public profile body must not contain the exact coordinate ${needle}`,
        ).not.toContain(needle);
      }
    });

    // ──────────────────────────────────────────────────────────────────────
    // 5. This journey's OWN renter takes a booking on listing A, on Russian
    //    so the notification's per-recipient rendering is provable.
    // ──────────────────────────────────────────────────────────────────────
    const user2Token = await apiLogin(request, ACCOUNTS.user2);

    await test.step('register this run\'s renter, book listing A, and put it on Russian', async () => {
      qaRenterToken = await apiRegister(request, qaRenter);

      const freshFeed = await getAllNotifications(request, qaRenterToken);
      expect(
        freshFeed,
        'fixture self-check: a freshly registered account must hold NO notifications, which is ' +
          'what makes the Pickup assertion below an absolute count instead of a delta against ' +
          'whatever the persistent dev DB has accumulated',
      ).toEqual([]);

      const start = new Date();
      start.setUTCDate(start.getUTCDate() + 90);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 2);
      const iso = (d: Date) => d.toISOString().slice(0, 10);

      const res = await request.post(`${API_URL}/api/bookings`, {
        headers: bearer(qaRenterToken),
        data: { listingId: listingAId, startDate: iso(start), endDate: iso(end) },
      });
      expect(res.ok(), `POST /api/bookings must succeed (${res.status()} ${await res.text()})`).toBe(
        true,
      );
      const booking = (await res.json()) as { id: string; status: string };
      bookingId = booking.id;
      expect(booking.status, 'a fresh booking is Pending, which is in-flight').toBe('Pending');

      // The Pickup copy is rendered ONCE, at emit time, in the recipient's language
      // (`NotificationEmitter.PickupAreaChangedAsync`). Leaving the renter on English would
      // leave that whole branch unexercised outside unit tests. Nothing restores this and
      // nothing has to: the account exists for this run only.
      await apiSetPreferredLanguageForToken(request, qaRenterToken, 'ru', qaRenter.email);
    });

    // A plain block, not a try/finally: this used to need one, to restore `renter@`'s language
    // whatever happened below. With a per-run renter there is nothing to restore, so the only
    // thing left is the indentation.
    {
      const districtsBefore = await test.step('read the district table (for the copy assertion)', async () => {
        const res = await request.get(`${API_URL}/api/districts`);
        expect(res.ok(), 'GET /api/districts must succeed').toBe(true);
        return (await res.json()) as DistrictPayload[];
      });
      const norNork = districtsBefore.find((d) => d.code === HOME_POINTS.norNork.districtCode);
      expect(norNork, 'the seeded district table must contain nor-nork').toBeTruthy();

      // ────────────────────────────────────────────────────────────────────
      // 6. THE MOVE. Every listing follows; no status changes.
      // ────────────────────────────────────────────────────────────────────
      await test.step('move the home point to Nor Nork', async () => {
        const res = await request.put(`${API_URL}/api/auth/me/home-point`, {
          headers: bearer(ownerToken!),
          data: {
            latitude: HOME_POINTS.norNork.latitude,
            longitude: HOME_POINTS.norNork.longitude,
          },
        });
        expect(res.ok(), `the move must succeed (${res.status()} ${await res.text()})`).toBe(true);

        const me = await getCurrentUser(request, ownerToken!);
        const point = me.homePoint!;
        expect(point.latitude).toBeCloseTo(HOME_POINTS.norNork.latitude, 6);
        expect(point.longitude).toBeCloseTo(HOME_POINTS.norNork.longitude, 6);
        expect(point.district!.code).toBe(HOME_POINTS.norNork.districtCode);
        expect(
          { lat: point.publicLatitude, lng: point.publicLongitude },
          'the snapped pair must have moved too — it is what every public surface shows',
        ).not.toEqual({
          lat: HOME_POINTS.kentron.publicLatitude,
          lng: HOME_POINTS.kentron.publicLongitude,
        });
      });

      await test.step('BOTH listings moved — the Approved one and the PendingApproval one', async () => {
        for (const [label, id] of [
          ['A (Approved)', listingAId!],
          ['B (PendingApproval)', listingBId!],
        ] as const) {
          const listing = await getListingAsOwner(request, ownerToken!, id);
          expect(
            Number(listing.latitude),
            `listing ${label} must have followed the home point — a listing left behind is a ` +
              `stale public pin sending renters to an address the owner left`,
          ).toBeCloseTo(HOME_POINTS.norNork.latitude, 6);
          expect(Number(listing.longitude), `listing ${label} longitude`).toBeCloseTo(
            HOME_POINTS.norNork.longitude,
            6,
          );
          expect(listing.district!.code, `listing ${label} district`).toBe(
            HOME_POINTS.norNork.districtCode,
          );
          expect(listing.city, `listing ${label} city`).toBe('Yerevan');
        }
      });

      await test.step('no status changed — a home move is never re-moderation', async () => {
        const mine = await getMyListings(request, ownerToken!);
        const a = mine.find((l) => l.id === listingAId);
        const b = mine.find((l) => l.id === listingBId);
        expect(a, 'listing A must still be in the owner catalogue').toBeTruthy();
        expect(b, 'listing B must still be in the owner catalogue').toBeTruthy();
        expect(
          a!.status,
          'the Approved listing must still be Approved — moving a pin must never push a live ' +
            'listing back through moderation',
        ).toBe('Approved');
        expect(b!.status, 'the PendingApproval listing must still be PendingApproval').toBe(
          'PendingApproval',
        );
      });

      await test.step('the anonymous surfaces now show the NEW snapped pair, still never the exact one', async () => {
        const me = await getCurrentUser(request, ownerToken!);
        const point = me.homePoint!;

        const res = await request.get(`${API_URL}/api/listings/${listingAId}`);
        expect(res.ok()).toBe(true);
        const listing = (await res.json()) as ListingDetails;
        // Equality with the owner's own snapped pair: the public coordinate
        // is the SAME derived value everywhere, which is the property that
        // keeps the map, the detail page and the owner's profile in agreement.
        expect(Number(listing.latitude)).toBeCloseTo(Number(point.publicLatitude), 6);
        expect(Number(listing.longitude)).toBeCloseTo(Number(point.publicLongitude), 6);
        expect(
          { lat: Number(listing.latitude), lng: Number(listing.longitude) },
          'the anonymous payload must not carry the new exact point either',
        ).not.toEqual({ lat: HOME_POINTS.norNork.latitude, lng: HOME_POINTS.norNork.longitude });
      });

      // ────────────────────────────────────────────────────────────────────
      // 7. The renter with a booking in flight is told; a renter without one
      //    is not.
      // ────────────────────────────────────────────────────────────────────
      await test.step('the renter holding the booking gets a Pickup notification, in Russian', async () => {
        const items = await getAllNotifications(request, qaRenterToken!);
        const pickups = items.filter(isPickup);
        expect(
          pickups.length,
          'the move must have emitted exactly ONE Pickup notification to this renter — one per ' +
            'in-flight booking, not one per listing the owner moved (this owner has two). An ' +
            'absolute count, not a delta: this renter was registered by this run and held no ' +
            'notifications at all before the move (asserted above)',
        ).toBe(1);

        const mine = pickups.find((n) => n.toy?.title === listingATitle);
        expect(
          mine,
          `a Pickup notification naming "${listingATitle}" must exist — the emit is best-effort ` +
            `and wrapped in catch{} on the server, so its absence is silent by design`,
        ).toBeTruthy();
        expect(
          mine!.primaryAction?.deepLink?.toLowerCase(),
          'it must deep-link to the booking it is about',
        ).toBe(`/bookings/${bookingId!.toLowerCase()}`);

        // Rendered at emit time in the RECIPIENT's language, not the owner's
        // and not the request's. Asserted through the district name rather
        // than the sentence around it, so a copy edit does not break the test
        // while a language regression still does.
        expect(
          mine!.body,
          `the body must name the new district in the recipient's language (${norNork!.nameRu})`,
        ).toContain(norNork!.nameRu);
        expect(
          mine!.body,
          'the body must not fall back to the English district name for a ru recipient',
        ).not.toContain(norNork!.nameEn);
      });

      await test.step('a renter with no booking on these listings is NOT notified', async () => {
        // The WHOLE feed, not its newest page: "nothing about this move reached this account"
        // is a statement over every row it holds, and a 20-item window cannot make it.
        const items = await getAllNotifications(request, user2Token);
        const about = items.filter(
          (n) => n.toy?.title === listingATitle || n.body.includes(listingATitle),
        );
        expect(
          about,
          'an account with no in-flight booking on this owner must receive nothing about the ' +
            'move — the fan-out is scoped to renters with a booking, not broadcast',
        ).toEqual([]);
      });

      // ────────────────────────────────────────────────────────────────────
      // 8. Outside Yerevan is refused for a new write — and a legacy row
      //    that already holds one keeps working (M-038).
      // ────────────────────────────────────────────────────────────────────
      await test.step('a point outside Yerevan is refused with 400 auth.home_point_outside_yerevan', async () => {
        const res = await request.put(`${API_URL}/api/auth/me/home-point`, {
          headers: bearer(ownerToken!),
          data: {
            latitude: HOME_POINTS.outsideYerevan.latitude,
            longitude: HOME_POINTS.outsideYerevan.longitude,
          },
          failOnStatusCode: false,
        });
        expect(res.status(), 'an out-of-town pin is a 400, not a 409 and not a silent 200').toBe(400);
        expect(errorCodeOf((await res.json()) as ProblemDetailsBody)).toBe(
          HOME_POINT_OUTSIDE_YEREVAN,
        );

        // The refusal changed nothing: the point is still where the move put
        // it. A refusal that half-applied would be worse than one that failed.
        const me = await getCurrentUser(request, ownerToken!);
        expect(me.homePoint!.latitude).toBeCloseTo(HOME_POINTS.norNork.latitude, 6);
        expect(me.homePoint!.district!.code).toBe(HOME_POINTS.norNork.districtCode);
      });

      await test.step('a LEGACY owner whose stored point is outside Yerevan can still edit and archive', async () => {
        // Constructed in the DB because the API can no longer produce it —
        // see `runDockerDbSql`'s doc comment, and M-038 for why this row must
        // keep working rather than be retro-validated. Public pair and
        // district go NULL: that is the shape the AddUserHomePoint migration
        // left for a point it could not resolve to a Yerevan district, and
        // nothing under test here reads either field.
        runDockerDbSql(
          `UPDATE Users SET HomeLatitude = ${HOME_POINTS.outsideYerevan.latitude}, ` +
            `HomeLongitude = ${HOME_POINTS.outsideYerevan.longitude}, ` +
            `HomePublicLatitude = NULL, HomePublicLongitude = NULL, HomeDistrictId = NULL ` +
            `WHERE Email = '${owner.email}';`,
        );

        const me = await getCurrentUser(request, ownerToken!);
        expect(
          me.homePoint!.district,
          'fixture self-check: the legacy row must read back with no district, or this step is ' +
            'not testing the legacy branch at all',
        ).toBeNull();

        const patch = await request.patch(`${API_URL}/api/listings/${listingBId}`, {
          headers: bearer(ownerToken!),
          data: { compensationAmount: 45000 },
          failOnStatusCode: false,
        });
        expect(
          patch.status(),
          `a legacy owner must still be able to edit their listing (got ${patch.status()} ` +
            `${await patch.text()}) — the Yerevan rule applies to NEW home-point writes only`,
        ).toBe(204);

        const archive = await request.post(`${API_URL}/api/listings/${listingBId}/archive`, {
          headers: bearer(ownerToken!),
          failOnStatusCode: false,
        });
        expect(
          archive.status(),
          `a legacy owner must still be able to archive their listing (got ${archive.status()})`,
        ).toBe(204);
      });
    }
  });

  test('publishing with no home point is refused with 409 listing.home_point_required', async ({
    request,
  }) => {
    await assertDockerStack(request);

    // renter@rental.local is a seeded account that deliberately has NO home
    // point (DevelopmentSeedData: null for every account that owns nothing).
    const renterToken = await apiLogin(request, ACCOUNTS.renter);
    const me = await getCurrentUser(request, renterToken);
    expect(
      me.homePoint,
      'fixture precondition: renter@rental.local must have no home point, or this test proves ' +
        'nothing. If it has one, something gave it a point — do not "fix" this by picking a ' +
        'different account before finding out what did.',
    ).toBeNull();

    const categoriesRes = await request.get(`${API_URL}/api/categories`);
    expect(categoriesRes.ok()).toBe(true);
    const categories = (await categoriesRes.json()) as { id: string }[];

    const res = await request.post(`${API_URL}/api/listings`, {
      headers: bearer(renterToken),
      data: {
        categoryId: categories[0].id,
        title: `QA No Home Point ${runId}`,
        description:
          'QA real-stack regression fixture — publishing without a home point must be refused.',
        pricePerDay: 1500,
        compensationAmount: 20000,
      },
      failOnStatusCode: false,
    });

    // 409, not 400: the request is well-formed, the ACCOUNT is not ready. The
    // client distinguishes them — a 409 with this code re-raises the
    // home-point gate in the wizard, a 400 would land as a dead-end banner.
    expect(
      res.status(),
      `publishing without a home point must be a 409 (got ${res.status()} ${await res.text()})`,
    ).toBe(409);
    expect(errorCodeOf((await res.json()) as ProblemDetailsBody)).toBe(
      LISTING_HOME_POINT_REQUIRED,
    );

    const mine = await getMyListings(request, renterToken);
    expect(
      mine.filter((l) => l.title.startsWith('QA No Home Point')),
      'a refused create must leave no listing behind',
    ).toEqual([]);
  });

  test('the anonymous district lookup answers null outside Yerevan and a district inside it', async ({
    request,
  }) => {
    await assertDockerStack(request);

    // No auth header on purpose: the sign-up wizard asks this question before
    // the account it belongs to exists, so AllowAnonymous is part of the
    // contract, not an oversight. `district: null` is the ONLY "this pin
    // cannot be saved" signal the client gets, and it has to agree exactly
    // with what the write side refuses — the two disagreeing is how a map
    // ends up saying "fine" about a pin the save then rejects.
    const inside = await request.get(
      `${API_URL}/api/districts/at?lat=${HOME_POINTS.kentron.latitude}&lng=${HOME_POINTS.kentron.longitude}`,
    );
    expect(inside.ok(), 'GET /api/districts/at must be callable anonymously').toBe(true);
    expect(((await inside.json()) as { district: DistrictPayload | null }).district?.code).toBe(
      HOME_POINTS.kentron.districtCode,
    );

    const outside = await request.get(
      `${API_URL}/api/districts/at?lat=${HOME_POINTS.outsideYerevan.latitude}&lng=${HOME_POINTS.outsideYerevan.longitude}`,
    );
    expect(outside.ok()).toBe(true);
    expect(
      ((await outside.json()) as { district: DistrictPayload | null }).district,
      'a point outside all 12 districts is a 200 with a null district, not an error — and that ' +
        'null is the same condition PUT /api/auth/me/home-point refuses with 400',
    ).toBeNull();
  });
});
