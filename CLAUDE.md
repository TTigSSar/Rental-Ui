# Rental-Ui — Frontend Rules

Angular 21, standalone components, NgRx (`@ngrx/store` + `@ngrx/effects`), PrimeNG 21 + primeicons, ngx-translate, Prettier.

## Structure

```
src/app/
├── api/api-contract.ts     ← THE single source of API paths + toApiUrl(); never hardcode '/api/...' elsewhere
├── features/<name>/        ← one folder per feature: components/ models/ pages/ services/ store/ routes.ts index.ts
│   (auth, listings, my-listings, bookings, favorites, reviews, notifications, chat, admin, profile, public-profiles, home, info)
└── shared/                 ← ui/ (reusable components), utils/
```

## Conventions

- Follow the existing feature-folder pattern exactly: API calls in `services/*-api.service.ts`, state in `store/` (NgRx actions/reducer/effects/selectors), route config in `routes.ts`, public surface re-exported via `index.ts`.
- All backend paths come from `ApiContract` + `toApiUrl()`; base URL is `environment.apiBaseUrl` (`https://localhost:7241` in dev). `/uploads/` is proxied to the API by `proxy.conf.json`.
- User-facing strings go through ngx-translate keys, not hardcoded text.
- UI components: prefer PrimeNG primitives + `shared/ui` before writing new ones.
- Match Prettier formatting (`.prettierrc` at repo root of the UI project).

## Feature status vocabulary (must match backend)

Listing: `Draft / PendingApproval / Approved / Rejected / Archived`. Booking: `Pending / Approved / Active / Completed / Rejected / Cancelled / Expired`.

## Chat backend (this note was once "no backend" — it is now REAL)

`features/chat/` is wired to a real backend: `ChatController` (booking-scoped conversations, messages, read cursors) + a SignalR hub at `/hubs/chat`. Verify live against a running API. Realtime works under `npm start` (Angular dev proxy) and `dotnet run`; it is currently BROKEN in the docker UI image (nginx doesn't proxy the hub — M-008), but the REST chat endpoints work in docker.

## Tests

- `npm test` — unit tests (bulk of coverage lives here).
- `npm run e2e` — Playwright journeys (`e2e/*.spec.ts`): real Angular app, backend **stubbed at network layer** by `e2e/support/api-mock.ts`; each test seeds only the state it asserts on. Keep this layer thin — only catastrophic-if-broken journeys. One-time setup: `npx playwright install chromium`.
