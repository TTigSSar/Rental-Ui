# Angular Rental Marketplace (Frontend)

## A. Project Overview

This repository is an **Angular standalone** single-page application for a **rental marketplace**: browse listings, open listing details, create listings (authenticated), manage favorites and bookings, moderate pending listings (admin role), view a profile, and use chat when signed in.

**Main user flows present in code**

- **Guest:** Browse `/listings`, open `/listings/:id`, register/login.
- **Authenticated:** Favorites, chat, my bookings, booking requests for hosts, my listings, create listing, profile; optional **Admin** pending listings moderation.
- **Auth:** Email/password login and register; **Google** and **Apple** external sign-in call the backend when provider tokens are obtained (see Auth Flow).

---

## B. Tech Stack

| Area | Package / setup (from `package.json` and `app.config.ts`) |
|------|-------------------------------------------------------------|
| **Angular** | `^21.2.x` (application builder `@angular/build`) |
| **State** | **NgRx Store + Effects** `@ngrx/store`, `@ngrx/effects` `^21.1.x` |
| **HTTP** | `provideHttpClient` with a **functional interceptor** (`authInterceptor`) |
| **UI** | **PrimeNG** `^21.1.5`, **PrimeIcons**, **@primeuix/themes** with **Aura** preset via `providePrimeNG` |
| **i18n** | **ngx-translate** `@ngx-translate/core` + `@ngx-translate/http-loader`; JSON under `public/i18n/` (`en`, `ru`, `hy` files exist) |
| **Other** | RxJS `~7.8`, TypeScript `~5.9`, **Vitest** in devDependencies; unit test entry is `ng test` (builder present) |

---

## C. Architecture

### Folder layout (high level)

```
src/app/
  api/                 # Shared API helpers: contract, URL builder, HTTP error text utility
  features/            # Domain features (each with pages, components, services, store)
  shared/ui/           # Reusable presentational UI (avatar, badge, empty state, etc.)
  app.ts, app.html     # Root shell (nav, auth-aware menu, router-outlet)
  app.routes.ts        # Top-level lazy routes
  app.config.ts        # Router, HttpClient, NgRx, Translate, PrimeNG
```

There is **no** `src/app/core/` folder in this codebase; cross-cutting API concerns live under `src/app/api/`.

### Feature structure

Each feature under `src/app/features/<name>/` typically includes:

- **`routes.ts`** — lazy-loaded child routes (where applicable)
- **`services/*-api.service.ts`** — `HttpClient` calls only in services (not in components, per project pattern)
- **`store/`** — actions, reducer, effects, selectors, state interface (for features using NgRx)
- **`pages/`**, **`components/`** — routed pages and building blocks

### State management

- **NgRx** is registered in `app.config.ts` with `provideStore()`, `provideState(...)` per feature, and `provideEffects(...)`.
- **Feature slices** (keys match `*FeatureKey` exports): `auth`, `listings`, `favorites`, `bookings`, `myListings`, `profile`, `chat`, `adminModeration`.
- **Global vs feature:** All listed slices are registered at app root; there is no separate “meta-reducer” folder beyond standard NgRx usage in each feature.

### API communication pattern

- **`src/app/api/api-contract.ts`** defines path constants and small helpers (e.g. `byId(id)`).
- **`toApiUrl(path)`** prefixes paths with `environment.apiBaseUrl` (trailing slashes normalized).
- Feature **API services** inject `HttpClient` and call `toApiUrl(ApiContract....)`.
- **`src/app/api/http-error-message.util.ts`** centralizes parsing of `HttpErrorResponse` into user-facing strings (used heavily in effects).

---

## D. Implemented Features

Only what exists in the repository is listed below.

### Auth (`features/auth`)

- **Implemented:** Login and register pages (`/auth/login`, `/auth/register`) with reactive forms, validation messaging, loading on `selectAuthLoading`, store-driven errors. **External auth** actions/effects call `POST /api/auth/external` after Google GIS or Apple flow supplies an `idToken`. Token saved via `AuthTokenService` (localStorage). On `ROOT_EFFECTS_INIT`, if a token exists, `loadCurrentUser` runs. After `loadCurrentUserSuccess`, navigation to `/listings` occurs **only if** the current URL starts with `/auth/`.
- **Guards:** `authGuard`, `guestGuard`; admin uses `adminGuard` under `features/admin`.
- **Incomplete / caveats:** Apple config in `environment.ts` / `environment.prod.ts` has **empty** `clientId` and `redirectUri` by default—Apple sign-in will fail until configured. Google requires a non-empty client id from environment. **Redirect-after-login to a deep link** beyond “leave `/auth/*`” is not implemented in effects (only the `/auth/` → `/listings` rule exists).

### Listings (`features/listings`)

- **Implemented:** List page with filters, pagination/infinite append, loading/error/empty UI; listing details with gallery, favorite toggle, booking UI tied to bookings store; create listing with categories load, multipart image upload after create, success navigation to new listing id via `CreateListingPageComponent` effect.
- **Favorites from listings:** Optimistic favorite toggle is handled in **listings** effects (`toggleFavoriteOptimistic` → API add/remove), with rollback on failure—not in the favorites feature slice.

### Favorites (`features/favorites`)

- **Implemented:** Load favorites list; **remove** favorite with optimistic update and rollback path in reducer/effects.
- **Incomplete:** There is **no** “add favorite” action in the favorites store; adding is done via **listings** toggle only. The favorites page does not re-fetch after an add from elsewhere unless the user refreshes or navigates in a way that dispatches `loadFavorites` again.

### Bookings (`features/bookings`)

- **Implemented:** Create booking (from listing details flow), load my bookings, load booking requests, approve/reject request; NgRx effects call `BookingsApiService`.

### My listings (`features/my-listings`)

- **Implemented:** Load current user’s listings via dedicated API service and NgRx slice; cards and page chrome present.

### Admin moderation (`features/admin`)

- **Implemented:** Pending listings page at `/admin/listings/pending`, load/approve/reject via `AdminListingsApiService`; guarded by `adminGuard` checking `user.roles` for `'Admin'`.

### Profile (`features/profile`)

- **Implemented:** Profile page loads: if `selectAuthUser` is already set, profile is **mapped from auth user** without an extra HTTP call; if `authUser` is null, it falls back to `GET` profile API. NgRx profile slice exists.

### Chat (`features/chat`)

- **Implemented:** Conversations list and conversation detail routes; effects load conversations, load details, send message via `ChatApiService` against contract paths. **Not “partial” in the sense of mocks**—it is wired like other features.
- **Caveats:** Behavior depends entirely on backend availability and response shapes; no separate mock layer was found in the chat API service.

---

## E. Auth Flow

1. **Login / register:** Components dispatch `login` / `register` with payloads matching `LoginRequest` / `RegisterRequest` in `auth.models.ts`. Effects call `AuthApiService` → `POST` login/register → `*Success` stores token in state → `persistToken$` writes **localStorage** (`auth_token`) → `loadCurrentUserAfterAuth$` dispatches `loadCurrentUser`.
2. **`GET /api/auth/me`:** `loadCurrentUser$` uses token from store or `AuthTokenService`. On failure, `loadCurrentUserFailure` may pass **`preserveSession: true`** (no token) or **`false`** (API error path clears token via effect).
3. **Interceptor:** `authInterceptor` attaches `Authorization: Bearer <token>` for requests whose pathname is **not** in the unauthenticated set: login, register, external.
4. **Guards:**
   - **`authGuard`:** Allows route if `selectIsAuthenticated` **or** a non-empty trimmed token exists.
   - **`guestGuard`:** Redirects to `/listings` if authenticated **or** token present.
   - **`adminGuard`:** Requires admin role; may dispatch `loadCurrentUser()` and wait for loading to finish before deciding.
5. **External auth (Google / Apple):** UI dispatches `externalAuth` with empty `idToken`; `resolveExternalAuthToken$` obtains token via `ExternalAuthProviderService` (GIS / Apple script), then `externalAuth$` posts to backend. Success path matches email auth (token + `loadCurrentUser`).

---

## F. State Management (NgRx)

| Feature key | Typical responsibilities |
|-------------|-------------------------|
| `auth` | Token, user, loading, error; login/register/external/loadCurrentUser/logout |
| `listings` | List, filters, pagination, details, categories, create listing + upload, favorite toggle persistence |
| `favorites` | Favorites list load/remove optimistic |
| `bookings` | Create booking, my bookings, requests, approve/reject |
| `myListings` | Owner listings list |
| `profile` | Profile view model (often derived from auth user) |
| `chat` | Conversations, active conversation, messages, send |
| `adminModeration` | Pending listings moderation |

Selectors and actions are colocated under each feature’s `store/` folder.

---

## G. Routing

**Root (`app.routes.ts`)**

| Path | Load | Notes |
|------|------|--------|
| `''` | redirect | → `listings` |
| `auth` | lazy | guest-only login/register |
| `listings` | lazy | public list + details; `create` and `:id` nested in feature routes |
| `profile` | lazy | `authGuard` |
| `my-listings` | lazy | `authGuard` |
| `bookings` | lazy | `authGuard`; nested `requests` |
| `chat` | lazy | `authGuard`; nested `:conversationId` |
| `favorites` | lazy | `authGuard` |
| `admin` | lazy | `adminGuard`; child `listings/pending` |
| `**` | redirect | → `listings` |

**Notable feature paths**

- Create listing: `/listings/create` (`authGuard`).
- Listing details: `/listings/:id` (public).
- Booking requests: `/bookings/requests` (still under parent `authGuard`).

---

## H. API Integration

- **Base URL:** `environment.apiBaseUrl` (`https://localhost:7241` in `environment.ts`; `https://api.example.com` placeholder in `environment.prod.ts`).
- **Contract:** `ApiContract` in `src/app/api/api-contract.ts` documents paths used by services, including:
  - **Auth:** `/api/auth/login`, `/register`, `/me`, `/external`
  - **Listings:** `/api/listings`, `/api/listings/{id}`, `/api/listings/mine`, `/api/listings/{id}/images`
  - **Categories:** `/api/categories`
  - **Favorites:** `/api/favorites`, `/api/favorites/{listingId}`
  - **Bookings:** `/api/bookings`, `/mine`, `/requests`, `/{id}/approve`, `/{id}/reject`
  - **Admin:** `/api/admin/listings/pending`, approve/reject by listing id
  - **Profile:** `/api/profile/me`
  - **Chat:** `/api/chat/conversations`, `/api/chat/conversations/{id}`, `/api/chat/messages`
- **Interceptor:** Adds JWT except for the three auth endpoints above.
- **Errors:** Effects generally map failures through `toApiErrorMessage` (with a few auth-specific overrides in auth effects).

---

## I. UI / Design Status

- **Global styling:** `src/styles.css` defines CSS variables (colors, spacing, radii, shadows) and utility classes (e.g. `page-container`, `cards-grid`, input helpers). PrimeNG components receive global overrides there.
- **Shell:** `app.html` / `app.css` implement header, primary/secondary nav, avatar + logout when authenticated.
- **Shared UI:** `src/app/shared/ui/` contains **Avatar**, **Badge**, **EmptyState**, **LoadingSkeleton**, **ImageContainer**—used on several marketplace pages.
- **Auth pages:** Split-panel layout with marketing aside and form panel; social buttons styled as distinct Google (light) and Apple (dark) rows.
- **Figma:** The README cannot verify visual parity with an external Figma file; the codebase shows **intentional design-system styling** across listings, details, create listing, bookings, favorites, profile, admin, and auth. Any claim of “pixel-perfect Figma match” would require a separate design review.

---

## J. Environment Setup

### Prerequisites

- **Node.js** compatible with Angular 21 (see Angular docs for current LTS range).
- **npm** (project pins `packageManager` to npm `11.6.1` in `package.json`).

### Install and run

```bash
npm install
npm run start
```

`ng serve` defaults to port **4200**; use `ng serve --port <port>` if the port is busy.

### Configuration

| Variable / field | Location | Purpose |
|------------------|----------|---------|
| `apiBaseUrl` | `src/environments/environment.ts` / `environment.prod.ts` | All API calls via `toApiUrl` |
| `externalAuth` | Same files | `googleClientId` / nested `google.clientId`, Apple `clientId`, `redirectUri`, `scope`, `state`, `usePopup`, `scriptSrc` |

Production build replaces `environment.ts` with `environment.prod.ts` per `angular.json` `fileReplacements`.

---

## K. Known Gaps / TODO

Facts inferred only from code:

- **Favorites slice:** No add-favorite flow in `favorites` store; list may drift until reload if favorites are added only via listings toggle.
- **Apple sign-in:** Environment placeholders empty—won’t work until filled and backend supports it.
- **Tests:** Only `src/app/app.spec.ts` found; no broad unit/e2e suite for features.
- **No `core/` module:** If you expect a `core` layer (singleton services, interceptors folder), this project instead uses `api/` + feature services.
- **Backend dependency:** All flows assume a live API; there is no in-repo mock server. Database or server errors surface as user-facing strings only after `toApiErrorMessage` processing (still dependent on backend payload shape).
- **Auth redirect:** Post-login redirect is fixed to `/listings` when leaving `/auth/*` after successful `me`; no `returnUrl` query handling was found in `auth.effects.ts`.

---

## L. Development Rules (Observed in Code)

- **Standalone components** only (no NgModules in the app structure inspected).
- **Lazy-loaded routes** for each major feature from `app.routes.ts`.
- **NgRx** for server-backed state in the features listed above; components dispatch actions and bind to selectors/`async` pipes.
- **HTTP restricted to API services** under features (and `AuthApiService`, etc.); components use the store, not `HttpClient` directly.
- **Typed models** in `features/*/models` and `auth.models.ts`; avoid introducing `any` (project convention stated in prior tasks).
- **Strong typing for API paths** via `ApiContract` and `toApiUrl`.

---

## Quick reference: NPM scripts

| Script | Command |
|--------|---------|
| Start dev server | `npm run start` |
| Production build | `npm run build` |
| Unit tests | `npm run test` |
