# Rental Marketplace UI (Angular)

Production-style Angular front-end for a rental marketplace with role-aware navigation, auth flows, listings discovery, owner workflows, bookings management, moderation, favorites, and chat foundation.

## Tech Stack

- Angular standalone architecture
- TypeScript strict mode
- NgRx Store + Effects
- PrimeNG UI components
- ngx-translate i18n (`en`, `hy`, `ru`)
- JWT authentication with HTTP interceptor

## Run and Build

### Development

Use one of these commands:

```bash
npm run start
```

or

```bash
ng serve
```

App URL:

```text
http://localhost:4200/
```

> On Windows PowerShell with restricted script policy, run from `cmd` if needed:
>
> `cmd /c npm run start`

### Production Build

```bash
npm run build
```

## Global App Architecture

The app is organized by feature modules under `src/app/features`, each following a vertical-slice structure:

- `models` for typed contracts
- `services` for HTTP integration
- `store` for NgRx actions/reducer/selectors/effects/state
- `pages` for container pages
- `components` for reusable UI
- `routes.ts` for feature routing
- `index.ts` for route export

Global composition is managed in:

- `src/app/app.routes.ts` (route integration)
- `src/app/app.config.ts` (NgRx feature/effects wiring + HTTP + i18n + PrimeNG)
- `src/app/app.ts`, `app.html`, `app.css` (shared shell/navigation)

## Shared App Shell and Navigation

The root shell provides:

- Sticky global header
- Primary and secondary navigation zones
- Auth-aware and role-aware link visibility
- Logged-in user display + logout action

Navigation includes:

- Listings
- Favorites
- Chat
- Bookings
- My Listings
- Booking Requests
- Profile
- Admin Pending Moderation (Admin role only)
- Login/Register for guests

## Authentication

Feature: `features/auth`

Implemented:

- Login + register pages
- `auth.guard` for protected access
- `guest.guard` for guest-only pages
- NgRx auth state lifecycle
- Persisted JWT token support
- Startup hydration via effect
- JWT interceptor for API requests

## Listings (Public + Owner Create Flow)

Feature: `features/listings`

Implemented:

- Listings browse page
- Listing details page
- Filters and infinite-scroll pagination
- Favorite optimistic toggle with rollback
- Create Listing page + reusable form
- Create listing models/API/store actions/selectors/reducer/effects
- Category loading + image upload flow (`FormData`)

## Favorites

Feature: `features/favorites`  
Route: `/favorites` (protected)

Implemented:

- Favorites page with card grid
- Reuse of existing `listing-card` component
- GET favorites API integration
- Optimistic favorite removal + rollback on failure
- Loading / error / empty states

## My Listings (Owner Area)

Feature: `features/my-listings`  
Route: `/my-listings` (protected)

Implemented:

- Owner listing management page
- Status display (`PendingApproval`, `Approved`, `Rejected`, `Archived`)
- Listing cards with:
  - image
  - title
  - city
  - price/day
  - status
  - created date
- Future-ready actions: view / edit placeholder / archive placeholder
- NgRx data flow with loading/error/empty states

## Bookings

Feature: `features/bookings`  
Routes:

- `/bookings` (My Bookings)
- `/bookings/requests` (Booking Requests)

Implemented:

- My Bookings page:
  - listing title
  - date range
  - total price
  - status
  - created date
- Booking Requests page:
  - renter info
  - listing info
  - date range
  - total price
  - status
  - approve/reject actions
- NgRx + API integration for load and mutation actions
- Action-in-progress tracking for request moderation buttons
- Loading/error/empty handling

## Profile / My Account

Feature: `features/profile`  
Route: `/profile` (protected)

Implemented:

- Account information page
- Summary section
- Reuses auth user data when available
- Falls back to profile API when needed
- NgRx slice for loading/error safety

## Admin Moderation (Pending Listings)

Feature: `features/admin`  
Route: `/admin/listings/pending`

Implemented:

- Admin-only moderation page for pending listings
- Card details:
  - image
  - title
  - owner info
  - city
  - price/day
  - created date
- Moderation actions:
  - approve
  - reject
- NgRx + API integration
- Loading/error/empty/action-loading UX

Guard hardening:

- `admin.guard` checks authenticated state and user role
- conservative behavior during auth hydration
- prevents non-admin access predictably

## Chat Foundation

Feature: `features/chat`  
Routes:

- `/chat`
- `/chat/:conversationId`

Implemented:

- Conversations list page
- Conversation details page
- Message composer (non-realtime, API-based)
- Shared chat NgRx slice across both pages
- Loading/error/empty states in both views
- Future-ready structure for realtime extension later

## Global Hardening Passes Already Applied

- Navigation visibility aligned with feature access expectations
- Guard behavior tightened for auth/admin consistency
- Mutation effects made safer against unintended cancellation:
  - switched unsafe mutation flows to `concatMap` where needed
- Route protection consistency reviewed across protected features
- Translation key coverage aligned with visible UI strings

## i18n

All user-visible text uses translation keys in:

- `public/i18n/en.json`
- `public/i18n/hy.json`
- `public/i18n/ru.json`

## Current Route Map (High-Level)

- `/auth/login`, `/auth/register`
- `/listings`, `/listings/:id`, `/listings/create`
- `/favorites`
- `/my-listings`
- `/bookings`, `/bookings/requests`
- `/chat`, `/chat/:conversationId`
- `/profile`
- `/admin/listings/pending`

## Notes for Next Session

- Architecture is intentionally feature-sliced and scalable.
- Most pages already include standard loading/error/empty UX patterns.
- Mutation workflows include optimistic updates where appropriate and safe rollback paths.
- Build currently passes; bundle-size warning remains and can be optimized in a dedicated performance pass.
