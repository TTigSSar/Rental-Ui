# ToyRent — Child Toys Rental (Frontend)

## A. Project Overview

This repository is an **Angular standalone** single-page application for a **child toys rental MVP**: parents can browse rentable toys, view toy details, list their own toys for rent, manage bookings, and moderate pending toy listings (admin role).

**Product niche:** Families renting quality child toys to each other — less clutter at home, more variety for kids.

**MVP user flows**

| Role | Flows |
|------|-------|
| **Guest** | Browse toys (`/listings`), open toy details (`/listings/:id`), register, log in |
| **Authenticated parent** | Browse toys, view toy details + send rental request, list a toy (`/listings/create`), my toys (`/my-listings`), my bookings (`/bookings`), rental requests (`/bookings/requests`), profile |
| **Admin** | All authenticated flows + pending toy listings moderation (`/admin/listings/pending`) |

**Non-MVP features (code present, not promoted in primary nav)**

- **Chat** (`/chat`) — fully wired to the backend but hidden from the primary navigation.
- **Favorites** (`/favorites`) — wired; the favorite toggle on listing cards still works but the favorites page is not in the primary nav.
- **Google / Apple external auth** — code exists; Google requires a configured `clientId` in environment; Apple requires `clientId` + `redirectUri`; neither is stable in the default dev environment.

---

## B. Tech Stack

| Area | Package / setup |
|------|-----------------|
| **Angular** | `^21.2.x` (application builder `@angular/build`) |
| **State** | **NgRx Store + Effects** `@ngrx/store`, `@ngrx/effects` `^21.1.x` |
| **HTTP** | `provideHttpClient` with a functional interceptor (`authInterceptor`) |
| **UI** | **PrimeNG** `^21.1.5`, **PrimeIcons**, **@primeuix/themes** Aura preset via `providePrimeNG` |
| **i18n** | **ngx-translate** `@ngx-translate/core` + `@ngx-translate/http-loader`; JSON files under `public/i18n/` (`en`, `ru`, `hy`) |
| **Other** | RxJS `~7.8`, TypeScript `~5.9`, **Vitest** in devDependencies |

---

## C. Architecture

### Folder layout

```
src/app/
  api/                 # Shared API helpers: ApiContract, toApiUrl, http-error-message util
  features/            # Domain features (pages, components, services, NgRx store)
  shared/ui/           # Reusable presentational components (Avatar, Badge, EmptyState, …)
  app.ts               # Root shell: nav, auth-aware menu, router-outlet
  app.html             # Shell template
  app.routes.ts        # Top-level lazy routes
  app.config.ts        # Router, HttpClient, NgRx, Translate, PrimeNG providers
```

There is **no** `src/app/core/` folder; cross-cutting concerns live in `src/app/api/`.

### Feature structure

Each `src/app/features/<name>/` folder typically contains:

- **`routes.ts`** — lazy-loaded child routes
- **`services/*-api.service.ts`** — all `HttpClient` calls (never in components)
- **`store/`** — NgRx actions, reducer, effects, selectors, state interface
- **`pages/`** — routed page components
- **`components/`** — reusable building-block components
- **`models/`** — TypeScript interfaces for the feature domain

### State management

- NgRx is bootstrapped in `app.config.ts` with `provideStore()` and per-feature `provideState()` + `provideEffects()`.
- Feature state keys: `auth`, `listings`, `favorites`, `bookings`, `myListings`, `profile`, `chat`, `adminModeration`.

### API communication pattern

- **`ApiContract`** in `src/app/api/api-contract.ts` holds all path constants.
- **`toApiUrl(path)`** prepends `environment.apiBaseUrl`.
- Components dispatch NgRx actions → effects call services → services call `HttpClient`.
- **`toApiErrorMessage`** in `http-error-message.util.ts` converts `HttpErrorResponse` to user-facing strings used in effects.

---

## D. Implemented Features

### Auth (`features/auth`)

- Login and register pages (`/auth/login`, `/auth/register`) with reactive forms, validation, and store-driven errors.
- Token persisted to `localStorage` via `AuthTokenService`; on app start, if a token exists `loadCurrentUser` is dispatched.
- **External auth (Google / Apple)** is wired but not the primary login path. Both require environment credentials to function.
- Guards: `authGuard`, `guestGuard`, `adminGuard`.

### Toy Listings (`features/listings`)

**Browse toys (`/listings`)**
- Infinite-scroll list with filters (city, category ID, price range).
- Quick-category chips removed; categories come from the backend `/api/categories` endpoint.

**Toy details (`/listings/:id`)**
- Gallery, description, owner contact, and booking panel.
- Toy-specific fields displayed **only when returned by the backend** (no fake data):
  - `ageFromMonths` / `ageToMonths` → formatted age range
  - `condition` → mapped to a localised label or shown as-is
  - `hygieneNotes` → hygiene & cleaning section
  - `safetyNotes` → safety notes section
  - `depositAmount` → refundable deposit amount

**List a toy (`/listings/create`)** — requires auth
- Form submits to `POST /api/listings`.
- Required fields: toy name, description, category (from `/api/categories`), price/day, country, city.
- Optional toy-specific fields: `ageFromMonths`, `ageToMonths`, `condition`, `hygieneNotes`, `safetyNotes`, `depositAmount`.
- Image upload after listing creation via `POST /api/listings/{id}/images`.

### My Toys (`features/my-listings`)

- Loads the authenticated user's own listings via `GET /api/listings/mine`.
- Displays listing status (PendingApproval / Approved / Rejected / Archived).

### Bookings (`features/bookings`)

- **My Bookings** (`/bookings`): rentals made by the current user.
- **Rental Requests** (`/bookings/requests`): incoming requests for the user's toys; owner can approve or reject.

### Admin Moderation (`features/admin`)

- Pending Toy Listings at `/admin/listings/pending`.
- Load / approve / reject via `AdminListingsApiService`.
- Guarded by `adminGuard` (checks `user.roles` for `'Admin'`).

### Profile (`features/profile`)

- Reads from `selectAuthUser` when available; falls back to `GET /api/profile/me`.

### Chat (`features/chat`) — hidden from primary nav

- Conversations list and conversation detail; fully wired to the backend.
- Not accessible from the primary navigation (MVP deprioritised).

### Favorites (`features/favorites`) — hidden from primary nav

- Load and remove favorites. Add-favorite is handled by the listings store toggle.
- Page exists at `/favorites` but is not linked from primary nav.

---

## E. API Integration

> The backend still uses the generic `/api/listings` endpoints. **No API paths were renamed** during the child-toys MVP refocus.

| Domain | Endpoint |
|--------|----------|
| Auth | `POST /api/auth/login`, `/register`, `GET /api/auth/me`, `POST /api/auth/external` |
| Toy listings | `GET/POST /api/listings`, `GET /api/listings/{id}`, `GET /api/listings/mine`, `POST /api/listings/{id}/images` |
| Categories | `GET /api/categories` |
| Favorites | `GET /api/favorites`, `POST/DELETE /api/favorites/{listingId}` |
| Bookings | `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings/requests`, `POST /api/bookings/{id}/approve`, `POST /api/bookings/{id}/reject` |
| Admin | `GET /api/admin/listings/pending`, `POST /api/admin/listings/{id}/approve`, `POST /api/admin/listings/{id}/reject` |
| Profile | `GET /api/profile/me` |
| Chat | `GET /api/chat/conversations`, `GET /api/chat/conversations/{id}`, `POST /api/chat/messages` |

- **Base URL:** `environment.apiBaseUrl` — `https://localhost:7241` in `environment.ts`; `https://api.example.com` placeholder in `environment.prod.ts`.
- **Interceptor:** `authInterceptor` attaches `Authorization: Bearer <token>` for all requests except the three auth endpoints.

---

## F. Toy-Specific Data Fields

The following optional fields were added to `ListingDetails` and `CreateListingRequest`. They are only sent to / read from the backend — never faked client-side:

| Field | Type | Description |
|-------|------|-------------|
| `ageFromMonths` | `number \| null` | Minimum recommended age in months |
| `ageToMonths` | `number \| null` | Maximum recommended age in months |
| `condition` | `string \| null` | Toy condition: `New`, `LikeNew`, `Good`, `Fair`, or any string |
| `hygieneNotes` | `string \| null` | How the toy is cleaned between rentals |
| `safetyNotes` | `string \| null` | Safety warnings, small parts notices, etc. |
| `depositAmount` | `number \| null` | Refundable deposit amount |

---

## G. State Management (NgRx)

| Feature key | Responsibilities |
|-------------|-----------------|
| `auth` | Token, user object, loading, error; login / register / external auth / loadCurrentUser / logout |
| `listings` | Toy list, filters, pagination, details, categories, create listing + image upload, favorite toggle (optimistic) |
| `favorites` | Favorites list load / remove (optimistic) |
| `bookings` | Create booking, my bookings, rental requests, approve / reject |
| `myListings` | Owner toy listings |
| `profile` | Profile view model (derived from auth user or API) |
| `chat` | Conversations, active conversation, messages, send |
| `adminModeration` | Pending toy listings moderation |

---

## H. Routing

| Path | Auth | Notes |
|------|------|-------|
| `''` | — | Redirects to `/listings` |
| `auth` | Guest only | Login / register |
| `listings` | Public | Browse toys; nested `create` (auth required) and `:id` |
| `my-listings` | Auth | My toys |
| `bookings` | Auth | My bookings; nested `requests` |
| `profile` | Auth | Profile page |
| `admin` | Admin role | Pending toy listings moderation |
| `chat` | Auth | Conversations (not in primary nav) |
| `favorites` | Auth | Saved toys (not in primary nav) |
| `**` | — | Redirects to `/listings` |

**Primary navigation (visible in header)**

| State | Nav links |
|-------|-----------|
| Guest | Browse Toys, Log in, Sign up |
| Authenticated | Browse Toys, My Toys, My Bookings, Rental Requests, [Admin — if admin role] |

---

## I. i18n

Translation files in `public/i18n/`: `en.json`, `ru.json`, `hy.json`.

All user-facing strings use toy-focused language: "toys" instead of "listings", "rental request" instead of "booking request", "List a Toy" instead of "Add listing", etc.

The `LANGUAGE_STORAGE_KEY` is `stayfinder.lang` (legacy key retained to preserve saved language preference).

---

## J. Environment Setup

### Prerequisites

- Node.js compatible with Angular 21.
- npm (`packageManager` pinned to `npm@11.6.1` in `package.json`).

### Install and run

```bash
npm install
npm run start   # dev server on http://localhost:4200
```

### Build

```bash
npm run build   # production build (uses environment.prod.ts)
```

### Configuration

| Key | File | Purpose |
|-----|------|---------|
| `apiBaseUrl` | `src/environments/environment.ts` / `environment.prod.ts` | Base URL for all API calls |
| `externalAuth.google.clientId` | Same files | Required for Google Sign-in |
| `externalAuth.apple.*` | Same files | Required for Apple Sign-in |

---

## K. Known Gaps / TODO

- **External auth:** Google requires a real `clientId`; Apple requires `clientId` + `redirectUri`. Both are empty in the default dev environment.
- **Tests:** Only `src/app/app.spec.ts` exists; no broad feature-level test suite.
- **Auth redirect:** After login, the app always navigates to `/listings`. There is no `returnUrl` handling in `auth.effects.ts`.
- **Favorites add:** The add-favorite flow lives in the listings store; the favorites page list can drift until a reload dispatches `loadFavorites`.
- **Chat:** Fully wired but deprioritised in the MVP nav; backend availability required.

---

## L. Development Rules

- **Standalone components only** — no NgModules anywhere in the app.
- **Lazy-loaded routes** for every feature.
- **NgRx** for all server-backed state; components dispatch actions and read selectors only.
- **HTTP only in API services** — components never inject `HttpClient`.
- **No `any`** — all models and API payloads are explicitly typed.
- **No fake data** — toy-specific fields are shown only when the backend returns them.
- **API paths via `ApiContract`** — no inline URL strings in services.

---

## Quick reference

| Script | Command |
|--------|---------|
| Dev server | `npm run start` |
| Production build | `npm run build` |
| Unit tests | `npm run test` |
