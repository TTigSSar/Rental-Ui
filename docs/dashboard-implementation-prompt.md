# Implementation Prompt — Wire the `dashboard` feature to real data

> Hand this entire file to a coding agent working in the `app-ui` repo
> (`rental-app/Rental-Ui`). It is self-contained. Do **not** delete the
> dashboard feature — implement it for real.

## Role

You are a Senior Angular Engineer. The app is Angular 21, **standalone
components only**, NgRx Store + Effects, PrimeNG, ngx-translate, mobile-first.
Match the existing code style: `ChangeDetectionStrategy.OnPush` on every
component, signals + `store.selectSignal(...)` for reads, `@for`/`@if` control
flow with `track`, and i18n keys (never hardcoded user-facing strings).

## Problem

`src/app/features/dashboard/` currently renders **mock data**: hardcoded
arrays, Unsplash image URLs, English-only strings, and fake counts. It is a
prototype shell, not a working feature. Example offenders:

- `pages/my-rentals/my-rentals.component.ts` → `ALL_RENTALS` constant of fake rentals.
- `pages/incoming-requests/incoming-requests.component.ts` → fake requests.
- `pages/my-toys/my-toys.component.ts` → fake toys.
- `pages/favorites/favorites-page.component.ts` → fake saved toys.
- `components/profile-rail/profile-rail.component.ts` → hardcoded `count: 5`, `'2 upcoming'`, `count: 3`, `count: 8`.

It is reached only via the `/dashboard/*` routes (registered in
`src/app/app.routes.ts`). Nothing in the app links to it — the live nav links to
`/profile/*` instead (see `app.ts`, `shared/ui/app-header/app-header.component.html`,
`features/profile/pages/profile-page/profile-page.component.html`).

## Important context: the data and pages already exist

The four dashboard screens **duplicate** pages that are already fully wired to
real NgRx state. Reuse their selectors/effects — do not invent new state:

| Dashboard page | Real, already-working equivalent | Store to reuse |
|---|---|---|
| My rentals (`/dashboard/rentals`) | `features/bookings/pages/my-bookings-page` | `bookings` store: `loadMyBookings()`, `selectMyBookings`, `selectMyBookingsLoading` |
| Incoming requests (`/dashboard/requests`) | `features/bookings/pages/booking-requests-page` | `bookings` store: booking-requests actions/selectors |
| My toys (`/dashboard/my-toys`) | `features/my-listings/pages/my-listings-page` | `my-listings` store: `selectMyListings` + load action |
| Saved toys (`/dashboard/favorites`) | `features/favorites/pages/favorites-page` | `favorites` store: favorites selectors + load action |

Read each "real equivalent" page first and copy its data-loading pattern
(dispatch-on-init + `selectSignal`). The data models live in each feature's
`models/` folder (`MyBooking`, `BookingRequest`, `MyListing`, favorites listing).

## Decision required before you start

The dashboard and `/profile/*` are **two UIs over the same data**. Pick one and
state your choice in the PR description:

- **Option A (preferred): make `/dashboard/*` the canonical "my account" hub.**
  Wire it to real data, then point the nav/header/profile links at `/dashboard/*`
  and remove the now-redundant `/profile/(toys|rentals|requests|saved)` child
  routes. Update `isProfileChildUrl` in `app.ts` accordingly.
- **Option B: keep `/profile/*` canonical and delete `dashboard`.** Only do this
  if the product owner does not want the rail-style dashboard.

Do not silently ship both — that is the current bug.

## Tasks (Option A)

1. **Replace mock data with store reads** in all four dashboard pages. Delete
   `ALL_RENTALS` and the other mock constants. Dispatch the relevant load action
   in `ngOnInit`, read via `store.selectSignal(...)`, and derive the tab-filtered
   lists with `computed()` (keep the existing `FilterTabsComponent` UX).
2. **Drive `profile-rail` counts from state.** Replace the hardcoded `count`/
   `suffix` values in `profile-rail.component.ts` with `input()`s (or store
   selectors) so the badges reflect real counts. If you want a single source for
   the four counts, add a `loadDashboardSummary` to an existing store rather than
   a new global slice — keep it lazy (provide state/effects at the route).
3. **i18n everything.** Move all English strings in the dashboard templates/TS
   into `public/i18n/en.json`, `hy.json`, `ru.json` under a `dashboard.*`
   namespace. Use the `| translate` pipe. No literal user-facing text.
4. **Real images & avatars.** Use the listing/owner image URLs from the API
   models and the shared `app-ui-image-container` / `app-ui-avatar` components
   with proper fallbacks — never Unsplash placeholders.
5. **States.** Add loading (`app-ui-loading-skeleton`), empty
   (`app-ui-empty-state`), and error states to each page, matching how the real
   equivalent pages handle them.
6. **Wire the action buttons** ("Manage rental", "Message", "Cancel", "Leave
   review", etc.) to the real flows (`/bookings/:id`, `/chat/:id`,
   cancel-booking action, `/bookings/:id/review`). Remove buttons you cannot wire.
7. **Lazy-register state/effects** for any store the dashboard newly depends on,
   on the dashboard route's `providers`, rather than globally in `app.config.ts`.

## Backend expectations

The frontend API contract already exists in these services — the backend must
satisfy them (no new frontend HTTP layer should be needed):

- `features/bookings/services/bookings-api.service.ts` (my bookings, requests, cancel)
- `features/my-listings/services/my-listings-api.service.ts`
- `features/favorites/services/favorites-api.service.ts`

If you want the four rail counts in one round-trip, expose a single
`GET /api/dashboard/summary` returning `{ myToys, activeRentals, upcomingRentals,
incomingRequests, savedToys }` and consume it; otherwise derive counts from the
existing list endpoints. Base URL comes from `environment.apiBaseUrl`
(empty in prod = same-origin).

## Definition of done

- No mock/hardcoded data or Unsplash URLs anywhere under `features/dashboard/`.
- All four pages show real, per-user data with loading/empty/error states.
- All strings translated in en/hy/ru.
- `npx tsc -p tsconfig.app.json --noEmit` passes and `ng build` succeeds within
  the existing budgets in `angular.json`.
- Exactly one canonical account UI remains (no duplicate `/profile/*` vs
  `/dashboard/*` screens).
- One logical change per commit.
