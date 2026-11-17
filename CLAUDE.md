# Rental-Ui — Frontend Rules

Angular 21, standalone components, NgRx (`@ngrx/store` + `@ngrx/effects`), PrimeNG 21 + primeicons, ngx-translate, Prettier.

## Structure

```
src/app/
├── api/api-contract.ts     ← THE single source of API paths + toApiUrl(); never hardcode '/api/...' elsewhere
├── features/<name>/        ← one folder per feature: components/ models/ pages/ services/ store/ routes.ts index.ts
│   (admin, auth, bookings, chat, favorites, home, info, listings, my-listings, notifications, profile, public-profiles, reports, reviews)
└── shared/                 ← ui/ (reusable components), utils/
```

## Conventions

- Follow the existing feature-folder pattern exactly: API calls in `services/*-api.service.ts`, state in `store/` (NgRx actions/reducer/effects/selectors), route config in `routes.ts`, public surface re-exported via `index.ts`.
- All backend paths come from `ApiContract` + `toApiUrl()`; base URL is `environment.apiBaseUrl` (`https://localhost:7241` in dev). `/uploads/` is proxied to the API by `proxy.conf.json`.
- Map tiles: `shared/ui/map/map.component.ts` is the ONLY file allowed to import Leaflet or know a tile URL; `maplibre-gl` is imported only in `shared/ui/map/`, dynamically. Tile config comes via the `TILE_PROVIDER_CONFIG` DI token (defaults to `environment.tileProvider`), not a direct `environment` import, so tests can supply their own.
  - A real MapTiler key is checked in on purpose (`tileProvider.apiKey`, both environment files): a browser key ships in the bundle anyway; its protection is the allowed-origins allowlist (`dorent.am`, `www.dorent.am`, `localhost`). Do not move it behind a proxy/build secret, and never commit an unrestricted key. Rotation = MapTiler dashboard + the two environment files.
  - Empty key / no WebGL / style failure fall back to raster/OSM — the map never renders blank.
  - Details (vector style, labels, worker, fallbacks): ADR-007 in `../knowledge/decisions.md`.
- User-facing strings go through ngx-translate keys, not hardcoded text.
- UI components: prefer PrimeNG primitives + `shared/ui` before writing new ones.
- Match Prettier formatting (`.prettierrc` at repo root of the UI project).

## Feature status vocabulary (must match backend)

Listing: `Draft / PendingApproval / Approved / Rejected / Archived`. Booking: `Pending / Approved / Active / Completed / Rejected / Cancelled / Expired`.

## Chat backend

`features/chat/` is backed by `ChatController` + a SignalR hub at `/hubs/chat`; realtime works under `npm start`, `dotnet run` and the docker stack (M-008).

## Tests

- `npm test` — unit tests (bulk of coverage lives here).
- `npm run e2e` — Playwright journeys (`e2e/*.spec.ts`): real Angular app, backend **stubbed at network layer** by `e2e/support/api-mock.ts`; each test seeds only the state it asserts on. Keep this layer thin — only catastrophic-if-broken journeys. One-time setup: `npx playwright install chromium`.
- `npm run e2e:real` — QA-owned real-stack journeys in `e2e/real/` (Playwright project `real`), run against the docker stack (UI on :4200, API, SQL Server) and guarded by `e2e/support/real-stack.ts`. The mocked `npm run e2e` tier stays thin.
