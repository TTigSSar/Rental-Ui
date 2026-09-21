import { defineConfig, devices } from '@playwright/test';

/**
 * Two-tier E2E config — see e2e/README.md for the full architecture.
 *
 * `chromium` (mocked tier, `npm run e2e`): journeys run against the real Angular
 * app started by `webServer` (ng serve) with the backend stubbed at the network
 * layer — see e2e/support/api-mock.ts. No live API or database is required.
 *
 * `real` (real-stack tier, `npm run e2e:real`): journeys run against the REAL
 * docker stack (nginx UI on :4200, ASP.NET Core API on :8080, SQL Server), no
 * request mocking. Bring the stack up FIRST:
 *   docker compose -f rental-api/docker-compose.yml up --build -d
 * Every real spec starts with the stack guard in e2e/support/real-stack.ts,
 * which hard-fails when :4200 is not the docker nginx bundle (M-011: a stale
 * `ng serve` or docker image is indistinguishable from fresh by eye).
 *
 * `globalSetup` runs the inverse check once, automatically, for every mocked
 * (`chromium`) run: `webServer` below reuses whatever already answers on
 * :4200 (reuseExistingServer), including a stale docker `ui` container — see
 * e2e/support/global-setup.ts for why this can't live inside `webServer`
 * itself and isn't a per-spec-file call the way the real tier's guard is.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    // The dev server uses a self-signed cert for the API host; ignore TLS in tests.
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /real\//,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'real',
      testMatch: /real\/.*\.spec\.ts/,
      // Flaky policy: no retries locally or on CI for the real tier — a re-run
      // must never hide the original failure; flakiness gets investigated, not
      // retried away. Failure artifacts only (trace + screenshot), never on pass.
      retries: 0,
      // Real journeys span multiple contexts and full lifecycle transitions.
      timeout: 180_000,
      // Serialized on purpose (overrides the global fullyParallel default for
      // this project only — see testProject.workers). Every real spec logs in
      // through the real API, and AuthController's AuthPolicy rate limit (5
      // logins/min, partitioned by remote IP — RateLimiterExtensions.cs) is
      // shared by the WHOLE real-tier run, not per file: all Playwright traffic
      // reaches the docker API as one client IP. With `fullyParallel` across
      // ~6 workers, all 7 spec files' logins land in the API within seconds of
      // each other and blow straight through the budget (429s and, once one
      // account's login stalls, knock-on 180s test timeouts elsewhere) — this
      // was reproduced directly: a full parallel run failed twice, an
      // identical solo run of the same spec passed 4/4 times. Retries are
      // banned for this tier by policy (see above), so the fix has to be on
      // the demand side, not papered over with a re-run.
      // Paired with the module-level JWT cache in real-stack.ts's apiLogin:
      // that cache only dedupes logins for the SAME worker process (separate
      // Playwright workers are separate OS processes with independent module
      // state), so it only pays off once the whole real-tier run is forced
      // into a single worker. Workers:1 alone would still be too tight for
      // some interleavings (one login-heavy file can land 4-5 logins within
      // its own <20s run, leaving too little of the fixed 60s window's budget
      // for whatever runs right after it); the cache is what gives the
      // serialized run real headroom by cutting the total login count instead
      // of just spacing the same count out. Costs wall-clock time (files run
      // one after another instead of concurrently) — accepted deliberately:
      // correctness of an unretried tier over speed.
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
