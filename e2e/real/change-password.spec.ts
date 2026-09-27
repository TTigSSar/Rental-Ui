import { expect, test } from '@playwright/test';

import {
  ACCOUNTS,
  API_URL,
  assertDockerStack,
  assertLoginNotRateLimited,
  assertPasswordChangeNotRateLimited,
  loginViaDialog,
} from '../support/real-stack';

/**
 * Real-stack regression for change-password (ADR-021, `PUT /api/auth/me/password`).
 *
 * The mocked tier (`e2e/profile-security.spec.ts`) can only prove the FRONTEND's wiring —
 * routing, field-vs-banner error mapping — because its mock answers its own contract by
 * construction. It cannot prove a password actually changed on a real backend (M-020: a mock
 * that never talks to the real system proves nothing about the real system). This spec drives
 * the change through the real UI against the real docker API + SQL Server, then proves the
 * effect the mock cannot: the OLD credential is rejected and the NEW one is accepted by a real
 * login round trip.
 *
 * Account: `user2@rental.local` (`DevelopmentSeedCredentials.SecondUserEmail`) — the one seeded
 * account no other real-tier spec authenticates as (grep `ACCOUNTS\.` across `e2e/real/*.spec.ts`
 * before changing this). Every other demo account (`owner`/`renter`/`admin`) is shared by other
 * journeys via `real-stack.ts`'s cached-JWT reuse; mutating one of THEIR passwords here would
 * poison every other spec's `loginViaDialog`/`apiLogin` call for the rest of the run.
 *
 * Login-rate-limit budget (M-044 — `AuthController.AuthPolicy`, 5 logins/minute, partitioned by
 * remote IP, SHARED by the entire `--project=real` run, not per file): this spec makes exactly
 * THREE real `POST /api/auth/login` calls, and cannot make fewer without cutting an assertion
 * the task exists to make:
 *   1. `loginViaDialog` — the one genuine sign-in needed to drive the change through the real UI.
 *   2. the old-password-rejected check (expected 401) — half of "the pair is the whole point".
 *   3. the new-password-accepted check (expected 200) — the other half.
 * Restoring the seeded credential afterward, and VERIFYING the restore, both go through
 * `PUT /api/auth/me/password` instead — its own `password-change` rate-limit bucket (also 5/min,
 * completely separate from `auth`) — so neither spends any of the scarce login budget. The
 * verification is a deliberate probe rather than a 4th login: `AuthService.ChangePasswordAsync`
 * checks `currentPassword` validity BEFORE checking "new === current", so calling the endpoint
 * with `currentPassword = newPassword = <the seeded password>` returns `auth.password_unchanged`
 * only if the seeded password verified — i.e. only if the restore actually took. A wrong
 * currentPassword answers `auth.invalid_current_password` instead, which the assertion below
 * would fail on, exactly as a real 4th login attempt would have caught.
 *
 * Two invariants the `finally` block below is written to hold, found by `/code-review`
 * (2026-09-26) and fixed rather than papered over:
 *  - **A failure in the test body must never be masked by a `finally`-block failure.** If the
 *    body's own assertions fail (the regression this spec exists to catch) AND the cleanup then
 *    also fails, Playwright would report whichever one throws LAST — the cleanup's — hiding the
 *    real failure. `bodySucceeded` is set only as the final statement of the `try` block, so the
 *    `finally` block can tell the two cases apart: a cleanup problem after a body failure is
 *    logged for visibility (console + a test annotation) but never re-masks the original error; a
 *    cleanup problem after a clean body run is the only thing wrong with that run, so it's safe —
 *    and necessary — to surface as the test's own failure.
 *  - **The restore + verify PUTs share their own `password-change` rate-limit bucket** (5/min,
 *    also per-IP, separate from `auth` — see `assertPasswordChangeNotRateLimited` in
 *    `real-stack.ts`) and are not exempt from exhaustion just because they're cheap. A 429 there
 *    means the call never ran — NOT that the restore failed — so it's checked before either
 *    `expect()` reads the response as a pass/fail signal on the restore itself.
 */

// Deliberately fixed, not derived from a timestamp: deterministic test data per project
// convention, and the whole point of the try/finally below is that this value never survives
// the run either way.
const NEW_PASSWORD = 'E2eChangePwd1';

test.describe('Change password (real stack)', () => {
  test('changes through the real UI; old password rejected, new accepted; stays signed in', async (
    { page, request },
    testInfo,
  ) => {
    await assertDockerStack(request);

    const account = ACCOUNTS.user2;
    let changed = false;
    // Set ONLY as the final statement of the try block below (after every assertion in the body
    // has already passed) — see the file doc comment's first invariant.
    let bodySucceeded = false;

    try {
      await loginViaDialog(page, account);

      await page.goto('/profile/security');
      const form = page.locator('form.security-page__form');
      await form.locator('input.uii-native').nth(0).fill(account.password);
      await form.locator('input.uii-native').nth(1).fill(NEW_PASSWORD);
      await form.locator('input.uii-native').nth(2).fill(NEW_PASSWORD);

      // `changed` tracks the REAL backend response, not the UI's rendered success state — a
      // frontend bug that fails to render "Password updated" after a genuine 204 must still
      // trigger the restore below, or this spec would poison every later run over an unrelated
      // rendering defect. The real BCrypt hash+save round trip is why the response wait carries
      // an explicit timeout (mirrors loginViaDialog's own real-backend timeout in real-stack.ts).
      const [changeRes] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith('/api/auth/me/password') && res.request().method() === 'PUT',
          { timeout: 20_000 },
        ),
        form.locator('button[type="submit"]').click(),
      ]);
      if (changeRes.ok()) changed = true;
      expect(
        changeRes.status(),
        `PUT /api/auth/me/password via the real UI should succeed: ${changeRes.status()} ` +
          `${await changeRes.text().catch(() => '<unreadable body>')}`,
      ).toBe(204);

      // exact: true — the persistent live region (`role="status"`) now also contains "Password
      // updated" as a substring of its longer announcement text; a non-exact match resolves to
      // two elements (strict-mode violation). See the same fix in profile-security.spec.ts.
      await expect(page.getByText('Password updated', { exact: true })).toBeVisible();

      const oldLoginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: account.email, password: account.password },
        failOnStatusCode: false,
      });
      // Fail with the real cause, not a confusing "expected 401, got 429", if the shared login
      // budget (M-044) is what actually answered here.
      assertLoginNotRateLimited(oldLoginRes.status(), account.email);
      expect(
        oldLoginRes.status(),
        'the seeded (pre-change) password must be REJECTED once the change has taken effect',
      ).toBe(401);

      const newLoginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: account.email, password: NEW_PASSWORD },
        failOnStatusCode: false,
      });
      assertLoginNotRateLimited(newLoginRes.status(), account.email);
      expect(
        newLoginRes.ok(),
        `the new password must be ACCEPTED once the change has taken effect: ` +
          `${newLoginRes.status()} ${await newLoginRes.text()}`,
      ).toBe(true);

      // Still signed in immediately after the change (ADR-021 §5/6: tokens are not revoked on a
      // password change — not on this device, not on any other). Re-navigate the SAME browser
      // session (no re-login) to the parent /profile route and confirm authGuard still admits
      // it; an invalidated/rejected session would redirect to '/' instead (see auth.guard.ts).
      await page.goto('/profile');
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.locator('a[routerLink="/profile/security"]').first()).toBeVisible();

      // Last statement in the try block, deliberately — see the file doc comment.
      bodySucceeded = true;
    } finally {
      if (changed) {
        try {
          const token = await page.evaluate(() => localStorage.getItem('auth_token'));
          if (!token) {
            throw new Error(
              `change-password.spec.ts: cannot restore ${account.email}'s seeded password — no ` +
                `auth token left in the browser session to authorize the restore call. The ` +
                `seeded account is now on "${NEW_PASSWORD}" and needs a manual fix before any ` +
                `other spec signs in as ${account.email}.`,
            );
          }
          const authHeaders = { Authorization: `Bearer ${token}` };

          const restoreRes = await request.put(`${API_URL}/api/auth/me/password`, {
            headers: authHeaders,
            data: { currentPassword: NEW_PASSWORD, newPassword: account.password },
            failOnStatusCode: false,
          });
          // Check for the password-change bucket being exhausted BEFORE reading the status as a
          // pass/fail signal on the restore itself — a 429 means this call never ran, not that
          // the restore failed (see assertPasswordChangeNotRateLimited's doc comment).
          assertPasswordChangeNotRateLimited(
            restoreRes.status(),
            account.email,
            'restoring the seeded password',
          );
          expect(
            restoreRes.status(),
            `restoring ${account.email}'s seeded password failed: ${restoreRes.status()} ` +
              `${await restoreRes.text()}. The seeded account is now on "${NEW_PASSWORD}" and ` +
              `needs a manual fix before any other spec signs in as ${account.email}.`,
          ).toBe(204);

          // Verify the restore actually took — without a 4th real login. See the file doc
          // comment for why `password_unchanged` (not `invalid_current_password`) proves it.
          const verifyRes = await request.put(`${API_URL}/api/auth/me/password`, {
            headers: authHeaders,
            data: { currentPassword: account.password, newPassword: account.password },
            failOnStatusCode: false,
          });
          assertPasswordChangeNotRateLimited(
            verifyRes.status(),
            account.email,
            'the post-restore verification probe',
          );
          const verifyBody: { errorCode?: string } = await verifyRes.json().catch(() => ({}));
          expect(
            verifyRes.status(),
            `post-restore verification probe did not get the expected 400: ${verifyRes.status()} ` +
              `${JSON.stringify(verifyBody)}`,
          ).toBe(400);
          expect(
            verifyBody.errorCode,
            `post-restore verification got the WRONG errorCode — the seeded password for ` +
              `${account.email} was NOT actually restored (still "${NEW_PASSWORD}"?): ` +
              `${JSON.stringify(verifyBody)}`,
          ).toBe('auth.password_unchanged');
        } catch (cleanupError) {
          if (bodySucceeded) {
            // Nothing else is wrong with this run — a cleanup failure here IS the failure to
            // report.
            throw cleanupError;
          }
          // The test body already failed for its own reason (the regression this spec exists to
          // catch) — that is what MUST be reported, not this cleanup problem. Record it for
          // visibility without letting it override/mask the original failure.
          const description =
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
          console.error(
            '[change-password.spec.ts] cleanup failed AFTER the test body already failed — the ' +
              'ORIGINAL failure above is what matters; this is logged for visibility only:',
            cleanupError,
          );
          testInfo.annotations.push({ type: 'cleanup-issue', description });
        }
      }
    }
  });
});
