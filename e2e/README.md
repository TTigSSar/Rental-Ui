# E2E journeys (Playwright)

A thin top layer of the test pyramid: only the cross-cutting journeys where a
break is catastrophic. The unit/integration suites (`npm test`) carry the bulk of
the coverage.

## How it works

- The journeys run against the **real Angular app**. `playwright.config.ts`
  starts it with `npm start` (port 4200) and reuses an already-running dev server
  locally.
- The **backend is stubbed at the network layer** by `support/api-mock.ts` — no
  live API or database is needed. Each test seeds only the state it asserts on;
  unmatched requests get a benign success so the app boots cleanly.

## Running

```bash
# one-time: download the browser binaries
npx playwright install chromium

# run all journeys (starts the dev server automatically)
npm run e2e

# interactive / debugging
npm run e2e:ui
```

## Journeys

| File | Flow |
|------|------|
| `listings.smoke.spec.ts` | Browse listings + optimistic favorite toggle |
| `auth.spec.ts` | Login happy path + rejected-credentials error |
| `admin-moderation.spec.ts` | Admin approves a pending listing (queue clears) |

## Conventions

- Prefer resilient selectors: roles, stable CSS hooks (`.listing-card__title`,
  `.listing-card__fav-btn`), and `data-testid` where labels are translated.
- Seed wire-shape data via `support/fixtures.ts`, not inline JSON.
- Keep this layer small — push new assertions down to unit/integration tests
  whenever the logic can be exercised there instead.
