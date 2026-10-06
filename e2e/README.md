# E2E tests (Playwright) — two tiers

Two Playwright projects live in one `playwright.config.ts`. They answer different
questions and neither replaces the other.

| | `chromium` — mocked tier | `real` — real-stack tier |
|---|---|---|
| Command | `npm run e2e` | `npm run e2e:real` |
| App under test | real Angular app via `ng serve` (`webServer`) | docker UI (nginx) on :4200 |
| Backend | **stubbed at the network layer** by `support/api-mock.ts` | REAL ASP.NET Core API on :8080 + REAL SQL Server (docker) |
| Data | inline wire-shape seeds (`support/fixtures.ts`) | idempotent dev seed (demo accounts, fixed listing GUIDs) |
| Proves | UI wiring: routing, guards, NgRx flows, optimistic updates, rendering of a declared state | the whole system: real auth (BCrypt/JWT), authorization, status machines, SQL persistence, API↔UI contract in production-shaped containers |
| Cannot prove | anything about the real backend — the mock answers every `/api/**` request, so a broken server, contract drift, or a dead endpoint stays green (M-013) | nothing about uncommitted UI source — it tests the *built docker image*, not your working tree |
| Speed / when | seconds; every change | minutes incl. stack build; before merge and when touching booking/auth/roles |

Unit tiers below these: `npm test` (28 vitest specs, UI logic) and
`dotnet test rental-api/RentalPlatform.sln` (xUnit; note its "integration" tests
swap SQL Server for SQLite via `EnsureCreated` — see
`rental-api/src/RentalPlatform.Api/Extensions/MigrationExtensions.cs` — so they
do not exercise real SQL Server behaviour either). The real-stack tier is the
only automated layer where no boundary is faked.

## Running

```bash
# one-time
npx playwright install chromium

# mocked tier (starts ng serve itself; no API/DB needed)
npm run e2e
npm run e2e:ui          # interactive

# real-stack tier — bring the docker stack up FIRST, freshly built:
docker compose -f rental-api/docker-compose.yml up --build -d   # from the repo root
npm run e2e:real
```

### Who owns :4200 (M-011 — read before blaming a test)

`ng serve` and the docker UI container fight over port 4200, and a stale docker
bundle is indistinguishable from a fresh one by eye. Rules:

- **Real tier:** every real spec first runs `assertDockerStack()`
  (`support/real-stack.ts`): :4200 must answer with a `Server: nginx` header
  (docker UI) and :8080 must be the healthy docker API — otherwise the run
  hard-fails with instructions. Always start the stack with `--build` so the
  image contains the commit you think you are testing.
- **Mocked tier:** `webServer` reuses *anything* already listening on :4200 —
  including a docker container. If the docker stack is up, stop its `ui`
  service (or the stack) before `npm run e2e`, or you will silently test a
  stale bundle. This is now also enforced automatically: `globalSetup`
  (`support/global-setup.ts`) checks :4200 for the docker `Server: nginx`
  header before any mocked test runs and hard-fails with the same
  instructions if found — one check protects every mocked spec, including
  ones not yet written, instead of relying on remembering this paragraph.

### Real-tier rate-limit budgets (M-044 — read before re-running `--project=real` back-to-back)

`rental-api` rate-limits its sensitive auth endpoints per client IP, and in a `--project=real` run
those budgets are whole-suite resources: "5/minute" means 5 for the entire run, not 5 per spec
file.

**There are TWO `auth` buckets, not one — 5/minute each.** `AuthPolicy` (login AND register)
partitions on `context.Connection.RemoteIpAddress` (`RateLimiterExtensions.ResolveClientKey`), and
`ForwardedHeaders` is not enabled in `rental-api/docker-compose.yml` (nginx sets only `X-Real-IP`,
which nothing reads), so the API sees two different clients:

| Bucket | Who lands in it | What the API sees |
|---|---|---|
| **`direct`** | Node-side `APIRequestContext` calls to `API_URL` (`:8080`) — `apiLogin`, `apiRegister`, a spec's own `request.post('/api/auth/login')` | the host loopback address |
| **`proxied`** | every browser-originated request: the docker UI bundle is same-origin (`environment.prod.ts` `apiBaseUrl: ''`) and reaches the API through nginx's `location /api/` `proxy_pass` | the **UI container's** address |

Measured directly against the running stack (2026-10-05): five `POST /api/auth/login` calls to
:8080 exhausted that bucket (the 6th answered 429) while the very next login through :4200
returned 200, and so did the one after it.

This supersedes the single-bucket accounting M-044 and this file carried until 2026-10-05, which
both understated the suite's capacity (5, when it is 10) and hid a real hazard: *which* bucket an
account's one cached login spent depended on which call site happened to warm the cache first.
`owner@` was warmed either by `releaseListingForRenter`'s self-heal (`direct`, and only when a
previous run had left a booking behind) or by `loginViaDialog` (`proxied`) — so the suite's
per-bucket demand changed with the contents of the dev DB, and the `direct` side could reach 5 of
5 with no headroom and then 429 in whichever spec needed a login next. `AUTH_BUCKET_BY_EMAIL` in
`support/real-stack.ts` now fixes the bucket per account in one place, under the rule *"a
Node-side helper login spends the same bucket that account's own UI login would"*, so warming
order can no longer move the budget.

**One full run spends 8 auth calls: 4 of 5 in each bucket.** Measured, not derived — run
`E2E_AUTH_DEBUG=1 npx playwright test --project=real` and `noteAuthSpend` prints every auth call
with its bucket and that bucket's running total:

| # | Call | Bucket | Why it cannot be cached away |
|---|---|---|---|
| 1 | `apiLogin renter@` — booking-lifecycle's language self-heal | `proxied` | first use of the account; `loginViaDialog` later reuses the cached JWT |
| 2 | `loginViaDialog owner@` — booking-lifecycle | `proxied` | first use of the account |
| 3 | `loginViaDialog user2@` — change-password | `proxied` | first use of the account |
| 4 | `POST /api/auth/register` — home-point-journey's throwaway OWNER, through the real sign-up dialog | `proxied` | a register is structurally uncacheable: the account does not exist yet |
| 5 | `apiLogin admin@` — home-point-journey's approve step | `direct` | first use of the account; no real spec signs the admin in through the dialog |
| 6 | `apiRegister` — home-point-journey's throwaway RENTER | `direct` | as #4 |
| 7 | change-password's old-password-rejected probe (expects 401) | `direct` | only means anything as a genuine, uncached login |
| 8 | change-password's new-password-accepted probe (expects 200) | `direct` | the other half of that pair |

The four seeded demo accounts therefore cost one login each for the whole run — that is the
per-account JWT cache in `support/real-stack.ts`, which only pays off because the `real` project
is pinned to `workers: 1` (see `playwright.config.ts`) — and the two registers plus the two
deliberate probes are the irreducible remainder.

**`password-change` — `PUT /api/auth/me/password`, 5/minute, a THIRD and separate bucket.** Only
`real/change-password.spec.ts` uses this endpoint, spending **3 per run**: the change itself
(through the real UI), restoring the seeded password afterward, and a verification probe that
confirms the restore actually took — both the restore and the probe route through this endpoint
specifically so they cost nothing against the scarcer `auth` buckets. 3 of 5 leaves headroom; this
bucket is not the tight one.

**One full `npx playwright test --project=real` run fits inside every window. A second
back-to-back run does not.** Each window is fixed and ~60s wide, so two immediate full runs land
more than 5 calls of a bucket inside one window and the second run 429s partway through — and
because the budget is shared, the 429 can land on ANY spec still needing a fresh login, not just
the one that pushed the count over. **Leave ~60 seconds between full runs.** This is a
deliberate, accepted property of the suite (see the M-044 entry in `knowledge/mistakes.md`), not
something to fix with sleeps or retries in the tests.

`support/real-stack.ts` exports a 429 guard for each bucket — `assertLoginNotRateLimited` for the
`auth` endpoints (used by `apiLogin`/`apiRegister`/`loginViaDialog` and by change-password's two
probes) and `assertPasswordChangeNotRateLimited` for `PUT /api/auth/me/password` — and both fail
immediately with an explicit message naming the cause instead of surfacing as a generic timeout,
or worse, a misleading "restore failed" downstream. If you see either message, wait ~60 seconds
for the window to clear and re-run; it is not a flake and not a code regression. Note that even a
genuinely unrestored demo password is not data loss: `DevelopmentSeedRunner` resets every demo
account's password hash back to `Demo1234` on the next API startup whenever it no longer matches,
so restarting the docker `api` service also fixes it.

Measured (2026-09-26, 13 real-tier tests, under the old single-bucket accounting — kept because
the cascade it shows is still exactly what an exhausted bucket looks like):

| Run | Result |
|---|---|
| 1st (cold budget) | 13/13 passed (25.7s–34.6s) |
| 2nd (started immediately after the 1st) | 12/13 — `change-password.spec.ts` 429s on its login check |
| 3rd (started immediately after the 2nd) | 9/13 — cascades into `booking-lifecycle`, `language-persistence`, `map-pins-privacy` too, none of which touch the account `change-password.spec.ts` uses |
| 4th (started ~65s after the 3rd) | 13/13 passed again (25.7s) |

Re-measured (2026-10-05, 16 real-tier tests, after `home-point-journey.spec.ts` gained its own
per-run renter and the two buckets were separated and pinned). Both runs were on the
**accumulated** docker DB, with the 60-second gap between them as part of the procedure:

| Run | Result | Auth spend |
|---|---|---|
| 1st | 16/16 passed (26.9s) | `proxied` 4/5, `direct` 4/5 |
| 2nd (started ~2.5min after the 1st, with a full `npm run e2e` in between) | 16/16 passed (26.7s) | `proxied` 4/5, `direct` 4/5 |

Both runs were against a docker DB carrying 12 previous runs' worth of state (`renter@` at 33
notifications, 12 of them `Pickup`; 12 leftover `qa.home.point.*` owner accounts), and `renter@`'s
`Pickup` count did not move across either of them — the home-point journey now notifies its own
per-run renter, so that account is no longer an input to any assertion.

## Coverage map — critical journeys (2026-07-24)

Layers: **U** = unit (vitest / xUnit), **M** = mocked Playwright, **R** = real-stack Playwright.

| Journey | Covered today | Gap |
|---|---|---|
| Auth (login, session hydrate, blocked user) | U: auth store/guard specs, xUnit auth tests · M: `auth.spec.ts` happy + rejected · R: real BCrypt/JWT login exercised as part of the booking journey | no dedicated R spec for register / blocked@ rejection / expiry |
| Change password (ADR-021, `PUT /api/auth/me/password`) | U: xUnit `Auth/AuthServiceTests.cs` + `Api/ChangePasswordHttpTests.cs`, `security-page.component.spec.ts` · M: `profile-security.spec.ts` — reaches `/profile/security` from a settings row, forced 400 `auth.invalid_current_password` lands as a field error not a banner, forced 429 lands as the banner · **R: `real/change-password.spec.ts`** — changes the seeded `user2@rental.local` password through the real UI, then proves the pair the mock cannot: the old password is rejected (401) and the new one accepted by a real login, session survives the change (ADR-021 §5/6), seeded credential restored + verified in `finally` | register/blocked-user interaction with this endpoint not e2e-covered (unit-only: `AuthService.ChangePasswordAsync`'s blocked/external-provider branches) |
| Listing discovery (browse, filter, details) | U: store/selector specs, `listings-api.service.spec.ts` (param serialization) · M: `listings.smoke.spec.ts` render + favorite toggle, **`listing-details.spec.ts`** (review-aggregate 0.0-rating gate, gallery mosaic degradation at 1/7 images, lightbox open/Escape/focus a11y, highlights band / compensation spec tile "Not specified" state / breadcrumb category absence when their data is absent), **`listing-contact-privacy.spec.ts`** (owner phone number never renders at any booking status — Pending/Approved/Active/Completed — on details, the booking page, or the confirmation screen; the chat notice that replaced the old padlock copy is asserted present instead) · **R: `real/listings-search-filter.spec.ts`** — proves `?search=` actually narrows the real backend result set (regression for the search contract-drift bug, sibling of M-020) | age-group and distance filters have backend xUnit coverage (`ListingsQueryServiceFilterTests.cs`) and frontend param-serialization unit coverage, but no R spec — distance depends on `navigator.geolocation` (flaky in CI); pagination not e2e-covered at any layer; lightbox Escape-to-close is a confirmed bug (`closeOnEscape` silently defeated by `closable=false` in PrimeNG's `Dialog.bindGlobalListeners()`) tracked by an intentionally-failing `test.fail()` case in `listing-details.spec.ts` until fixed |
| Loss & damage compensation (`CompensationAmount`, renamed from `DepositAmount`) | U: `ListingCompensationAmountValidationTests.cs` (create required + range, update optional + range), `ListingsOwnerServiceTests.cs` (update omitted → unchanged, update changed → no re-moderation) · `create-listing-form.component.spec.ts` (required/range on submit, edit-mode Save-stays-enabled-and-jumps-to-step-3 regression, real-`p-inputNumber` not-silently-clamped regression) · M: `listing-details.spec.ts` (null state — spec tile shows "Not specified", still rendered) · **`listing-compensation-journey.spec.ts`** — a set amount renders identically across the details page's specs-quad tile, pickup/delivery row and protection card, then follows the real "Request to rent" CTA into the booking page and checks the compensation row (excluded from the total, "How this works" popover opens/closes) | populated-state rendering has no dedicated component-unit coverage on `listing-details-page.component.ts` / `listing-booking-page.component.ts` themselves (only the mocked e2e above) — a gap for frontend-dev to close, not re-tested here to avoid duplicating the same behaviour at two layers with no stated risk; no R (real-stack) coverage of the display surfaces, only of create-time persistence (see `real/create-listing-photo-upload.spec.ts`, which now also fills the required field and would fail if the real backend stopped round-tripping it) |
| Listing location (approximate-map tap-to-load, districts) | U: `ListingDetailCoordinatePrivacyTests`/`ListingDetailAddressRevealTests` (xUnit, privacy gate) · M: `create-listing-location.spec.ts` (step 3 is a read-only pickup-area card; the create payload carries none of the five removed fields; the no-home-point gate), `listing-location.spec.ts` (district/city text, tap-to-load map, no-coordinates fallback) · **R: `real/home-point-journey.spec.ts`** (see the row below — a listing has no location of its own any more, so this journey IS the listing-location coverage) | the per-listing pin picker no longer exists (home-point model); district override in the wizard is gone with it |
| **Home point (ADR-008 privacy model, home-point rework)** — one point per user, every listing inherits it | U: xUnit `HomePointServiceTests`, `HomePointRegistrationTests`, `HomePointHttpTests`, `HomePointCoordinatePrivacyTests`, `AddUserHomePointMigrationTests`, `PickupAreaChangedCopyTests` (SQLite) · `home-point-map.component.spec.ts`, `pickup-area-card.component.spec.ts`, auth/listings store specs · M: `auth-register-home.spec.ts` (the point travels in the one register request; Skip sends neither half), `profile-home-point.spec.ts` (Change → picker → "moves N toys" confirmation → PUT body; Cancel sends nothing), `create-listing-location.spec.ts` (the gate, the read-only card, the 409 re-raising the gate) · **R: `real/home-point-journey.spec.ts`** — registers a throwaway owner through the real two-step sign-up, pins the point to a documented constant, publishes through the real wizard, and then proves what no cheaper layer can: the snapped public pair and district are derived by the real `GeohashSnapper` + OSM boundary asset onto real `decimal(9,6)` columns; the anonymous listing payload, the anonymous map pin and the public profile never carry the exact pair; a move relocates BOTH of that owner's listings (Approved and PendingApproval) with no status change; the renter holding an in-flight booking gets a `Pickup` notification rendered in THEIR language while an uninvolved account gets nothing; an out-of-Yerevan write is refused 400 `auth.home_point_outside_yerevan` and changes nothing; an M-038 legacy owner whose stored point is outside Yerevan (constructed in the DB via `runDockerDbSql`, because the API can no longer produce such a row) can still edit and archive; publishing with no home point is 409 `listing.home_point_required`; `GET /api/districts/at` answers anonymously and its `null` agrees with what the write side refuses | the home-point MOVE is driven through `PUT /api/auth/me/home-point`, not the profile card's UI (a drag cannot guarantee a different geohash cell or district, which is what the notification trigger depends on — the card's own wire behaviour is pinned in `profile-home-point.spec.ts`); `DELETE /api/auth/me/home-point` and its 409 `auth.home_point_in_use` are unit-only; the renter-side "From your home" distance origin (ADR-015 3-decimal rounding, nothing sent until a radius is picked) has no R coverage |
| Map view (catalog, Maps P2-2: List/Map toggle, pin clustering, popups) | U: `listings-map.component.spec.ts` (real `app-map` + mocked Leaflet — grouping, 400ms viewport debounce, fitPins discipline, 150ms popup grace, truncated banner), xUnit `ListingMapPinsQueryServiceTests` + HTTP `ListingMapPinsHttpTests` (query-string binding, 400 on `minLng>maxLng`, wire shape) · **M: `listings-map.spec.ts`** — real Leaflet: toggle/URL/reload, N-coordinates-to-N-balls incl. the same-coordinate collapse (1 ball, 2 stacked popups), real-DOM hover popup + its `/listings/:id` link, the 150ms close-grace reachability, filter query-params re-attached on refetch | no real-stack (R) coverage of the map UI itself (privacy property is R-covered API-side, see `real/map-pins-privacy.spec.ts`); per-group uncertainty circles have no app-owned CSS hook so their render isn't asserted at any browser layer — see that spec's own doc comment |
| Booking request + lifecycle (Pending→Approved→Active→Completed) | U: xUnit `BookingsService` transition tests (SQLite) · M: **`listing-booking.spec.ts`** — the `note` field actually reaches the `POST /api/bookings` body (trimmed, whitespace-only → `null`), the confirmation echoes it back, `booking.note_too_long` renders translated (not the raw backend title), and a booked day renders disabled and un-selectable in the real calendar (regression for the `bookedDates`/`bookedDateRanges` field-rename bug) · **R: `real/booking-lifecycle.spec.ts` — full journey, both parties; the owner's phone number is asserted absent at every stage (Pending/Approved/Active/Completed), the booking's chat thread is asserted reachable from the confirmation screen, and the pickup address line is asserted to unlock at Approved+ — the one contact-reveal gate the product kept** | Rejected / Cancelled / Expired paths not e2e-covered (unit-only); real-stack coverage of the chat thread stops at "the thread is reachable and named correctly" — sending/receiving messages, SignalR realtime delivery, and the mocked-tier's own "Message {owner}" smoke check (POST fires, URL changes) are the only other chat coverage; the chat feature's messaging itself is still a largely uncovered journey (see the Chat row below) |
| Role boundaries renter/owner/admin | U: xUnit authorization tests · M: adminGuard admits seeded admin · R: owner-only handover/complete CTAs asserted for both roles | no R coverage for admin vs API (e.g. non-admin hitting /admin), blocked-user writes |
| Reviews | U: eligibility spec (`booking-details-page.eligibility.spec.ts`), xUnit review rules · R: "Leave a review" offered after real completion | submitting a review not e2e-covered at any layer |
| Uploads (listing images, chat attachments) | U: xUnit storage tests | **nothing automated exercises real multipart upload → disk → serve (M-013 root cause); highest-value next R spec** |
| Chat negotiate / messaging (SignalR) | U: chat store/component specs · xUnit ChatService | no e2e at all; realtime WS through nginx broke before (M-008) and only manual checks would catch it |
| Moderation (approve/reject listing) | U: xUnit admin tests, component specs for `review-card`/`reject-panel`/`reject-sheet`/`inspect-page` · M: `admin-moderation.spec.ts` — approve + tab-count update, reject-reason-required guard (desktop inline panel AND mobile bottom sheet), Pending/Approved/Rejected tab switching, inspect dossier (owner trust panel + compliance checklist), legacy `/admin/listings/pending` redirect, optimistic-approve rollback + error toast on a 500 | R: none (seeded PendingApproval listings exist — cheap to add) |
| Admin console — Users & Reports (account status, report triage) | U: `admin-users`/`admin-reports` store+reducer specs, `admin-user-guards.util.spec.ts` · M: `admin-users.spec.ts` — suspend guard for self/admin rows, suspend↔reactivate via the table quick-action, status tabs incl. no "Active" tab, mobile disabled-reason sheet, **suspend-from-inside-the-profile-dialog on the Pending ID tab** (regression: the dialog used to freeze on stale data when a mutation moved the row off the active tab — `users-page.component.ts` now applies `{verify,suspend,reactivate}UserSuccess`'s own row to the dialog snapshot independent of `items()`), **admin sees a user's phone number as a `tel:` link on both the row and the profile dialog** (the one surface still allowed to show it after the renter/owner-facing phone reveal was removed — see `listing-contact-privacy.spec.ts`); `admin-reports.spec.ts` — resolve/reopen quick-actions + tab-count updates, `userId` deep-link filter banner, mobile bottom-sheet resolve on the default Open tab, **resolve-from-inside-the-detail-dialog on the default Open tab plus its 500/rollback path** (same regression, `reports-page.component.ts`) | R: none; Verify action and dismiss-from-dialog (as opposed to resolve) not covered at any layer |
| Language switching + user-facing validation errors | U: some pipe/component specs · M: error-detail rendering on failed login | no e2e for hy/ru switch persistence or localized validation texts |
| Client/server contract conformance (every `ApiContract` path resolves to a real backend route) | **R: `real/api-contract-conformance.spec.ts`** — diffs `ApiContract` against the live API's OpenAPI route table | verb (GET/POST) not checked, only path existence; auth/authorization on the route not checked |
| Runtime translation delivery (`/i18n/{lang}.json` HTTP caching) | **R: `real/i18n-cache-headers.spec.ts`** — asserts the real docker nginx sends `Cache-Control: no-cache` for en/ru/hy, that a `?v=` build-stamp query string does not defeat the rule, and that the adjacent `/index.html` (no-cache) and hashed-asset (`immutable`) rules stay untouched. Regression for the dorent.am stale-translations incident (2026-08-14): nginx sent no header at all, so browsers heuristically cached old translations past a deploy while hash-named JS updated normally | none — this is a response-header property with no browser-rendering component; the build-stamp URL shape itself is unit-tested (`app.config.spec.ts`), not duplicated here |
| Profile page (view own profile: phone, language, avatar) | U: `profile-api.service.spec.ts` pins the endpoint URL and role mapping | no e2e at any layer for the rendered page itself — see `api-contract-conformance.spec.ts` docblock for why route-existence (not a browser journey) was the fix chosen for the dorent.am `/api/profile/me` incident |

Keep the mocked tier **thin** — catastrophic-if-broken journeys only. New
regression coverage grows in the real tier or below (unit/integration), never as
mocked-tier sprawl.

## Real-tier determinism (persistent dev DB)

Bookings created by tests **persist between runs**. `real/booking-lifecycle.spec.ts`
stays re-runnable because:

1. **Seed invariants only** — fixed listing GUID (`Wooden Toy Kitchen Set`,
   owned by `owner@rental.local`), demo accounts, seeded owner phone. No
   volatile data. Coordinates are a seed invariant too, but they now belong to
   the OWNER, not the listing: `TOY_KITCHEN.exactLatitude/exactLongitude` in
   `support/real-stack.ts` is `owner@rental.local`'s seeded home point
   (`DevelopmentSeedData.HomePoints.Kentron`), and every listing of that owner
   reads back the same pair. Moving that one seeded point moves all of them, so
   the constants are documented together with the geohash-7 centroid they
   derive to.
2. **Collision-free windows** — the rental window starts two months out on a
   day derived from the run timestamp; and every booking the spec creates is
   driven to `Completed`, which is terminal and never blocks future ranges
   (only Pending/Approved bookings block).
3. **Self-heal, not manual cleanup** — a crashed run can strand a
   Pending/Approved/Active booking, which disables the listing's book CTA for
   the renter. `releaseListingForRenter()` drives leftovers to a terminal state
   through the real API before the journey starts.

If a journey ever needs data the seed cannot guarantee, extend the dev seed
(spec it for backend-dev) — do not build workarounds on volatile state.

**One journey owns its own accounts instead.** `real/home-point-journey.spec.ts`
registers a throwaway OWNER *and* a throwaway RENTER per run (timestamped
emails) rather than mutating seeded ones, because its subject IS mutating a
user:

- the owner, because moving a home point rewrites every listing that user owns,
  and doing that to `owner@rental.local` would move the `TOY_KITCHEN` pin that
  `map-pins-privacy.spec.ts` and this file's own documented constants depend on;
- the renter, because the assertion it exists for is *"the move emitted exactly
  ONE `Pickup` notification to the renter holding a booking"*, and on a shared
  seeded account that is a statement about accumulated state. It used to borrow
  `renter@`, which is a recipient of the dev seed's own home-point fan-out and
  of every previous run's bookings, so the count had to be a delta — and then
  the delta silently stopped working: `GET /api/notifications` is cursor-
  paginated at 20 items, `renter@` crossed 20, and a newly emitted `Pickup`
  began pushing an older item off the bottom of the page instead of changing
  the in-page count. The app was right (11 `Pickup` rows existed, 8 were
  visible) and the test was wrong. A renter registered by the run holds zero
  notifications, which makes the assertion absolute and immune to accumulation;
  `getAllNotifications` in that spec additionally walks `nextCursor` to the end
  and cross-checks the walked count against the feed's own `counts.all`, so a
  partial read can never again read as a smaller count. Borrowing `renter@`
  also meant driving it to Russian and restoring English in a `finally` a
  hard-killed run would skip; a throwaway renter is simply left on `ru`.

Both accounts' listings are archived and the booking cancelled in `afterEach`;
the account rows are deliberately left behind (owning nothing visible) rather
than hand-walking FK cascades to delete them.

**One fixture, and only one, bypasses the API.** `runDockerDbSql` in
`support/real-stack.ts` runs a statement against the docker SQL Server through
`docker compose exec`. It exists for a single class of fixture: a row the API
can no longer produce. M-038 keeps pre-existing out-of-Yerevan home points
working while refusing every new one, so "a legacy owner can still edit and
archive" is untestable through the API alone. It is a fixture tool, never an
assertion tool — assertions go through the API, so what is proven is what a
real client sees — and it writes only to rows the calling spec created itself.

## Flaky policy

- A flaky test is a **bug of the suite** — investigate it; do not tolerate,
  re-run, or quietly weaken it. A pass obtained by re-running is not a pass,
  and the original failure stays in whatever report you write.
- **Retries:** real tier `retries: 0` everywhere — its failures must surface,
  not be averaged away. Mocked tier keeps `retries: 1` on CI only, solely so a
  transient `ng serve` boot hiccup does not block CI; locally it is 0. Any new
  retry needs a written justification in the config.
- **Artifacts on failure only:** real tier uses `trace: 'retain-on-failure'` +
  `screenshot: 'only-on-failure'`; mocked tier `trace: 'on-first-retry'`. No
  video, no artifacts on green runs.
- **No `skip`/`fixme`/arbitrary waits** without a stated reason in the code and
  the commit message. Explicit long timeouts exist only where a real slow
  operation is named (e.g. BCrypt login round-trip, docker cold start).

## Conventions

- Selectors: roles and accessible names first, stable CSS hooks
  (`.listing-card__title`, `app-booking-status-badge`) second, `data-testid`
  where labels are translated.
- Default UI language is `en` when localStorage is empty — English label
  assertions are stable.
- Mocked seeds go through `support/fixtures.ts`; real-tier helpers through
  `support/real-stack.ts`. Real specs live in `e2e/real/` and never import
  `api-mock.ts`.
- Real tests run against the local docker stack ONLY — never against
  https://dorent.am or any production host.
