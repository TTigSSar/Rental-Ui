import { expect, test } from '@playwright/test';

import {
  apiRegister,
  assertDockerStack,
  awaitRateWindow,
  loginViaDialog,
  runDockerDbSql,
} from '../support/real-stack';

/**
 * ADR-067 (chat Web Push) logout cleanup on the real stack. The original bug (Trello #252, found
 * pre-merge): the logout `DELETE /api/push/subscription` was sent AFTER the auth token was cleared,
 * so it carried no Authorization header, got a 401 and the PushSubscriptions row stayed orphaned
 * (a dead endpoint the server kept pushing to). Fixed in Rental-Ui d752e92: the service remembers
 * the token of its last successful PUT and sends the logout DELETE with an explicit header, and
 * `authInterceptor` leaves a request that already has one alone. Each half is unit-tested next to
 * the code with a mocked HttpClient; only the real nginx + API + SQL Server can prove the row is
 * actually gone (M-013: the layer every test fakes is the layer nobody tests).
 *
 * Browser seam: a headless browser has no push service, so `pushManager.subscribe()` cannot work.
 * `Notification.permission` is forced to 'granted' and `PushManager.prototype.getSubscription` is patched in an init script to return an
 * fcm.googleapis.com subscription (an allow-listed host with well-formed keys); the service then
 * takes its "existing subscription" branch and re-registers it with the REAL PUT. Everything past
 * the browser API (the PUT, the DB row, the DELETE, the cleanup) is real. The VAPID keys are NOT
 * needed: PUT/DELETE `/api/push/subscription` never touch them (only `GET /public-key` and the
 * dispatcher do), so the docker stack runs unchanged and no key material is committed.
 *
 * Account: a THROWAWAY registered user (rerunnable, no order dependence). Budget: 1 `auth` direct
 * (register); the tab signs in from the cached token, no login dialog.
 */
test.describe('Push subscription is removed on logout (real stack, ADR-067)', () => {
  const runId = Date.now().toString(36);
  const user = {
    firstName: 'Qa',
    lastName: 'Push',
    phone: '+37491235891',
    email: `qa.push.${runId}@rental.local`,
    password: 'Demo1234',
  };
  const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${runId}`;

  const rowCount = (): number =>
    Number(
      runDockerDbSql(
        `SELECT COUNT(*) FROM PushSubscriptions ps JOIN Users u ON u.Id = ps.UserId ` +
          `WHERE u.Email = '${user.email}' AND ps.Endpoint = '${endpoint}'`,
      ),
    );

  test('logout sends an authenticated DELETE (204) and the row is gone', async ({
    page,
    request,
  }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 1);
    await apiRegister(request, user);

    await page.addInitScript((endpointUrl) => {
      const bytes = (length: number, seed: number): string => {
        const raw = Uint8Array.from({ length }, (_, i) => (i * 7 + seed) % 256);
        return btoa(String.fromCharCode(...raw))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      };
      // Headless Chromium reports Notification.permission 'denied' even after grantPermissions.
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      let live = true;
      const fake = {
        endpoint: endpointUrl,
        toJSON: () => ({ endpoint: endpointUrl, keys: { p256dh: bytes(65, 3), auth: bytes(16, 5) } }),
        unsubscribe: async () => {
          live = false;
          return true;
        },
      };
      PushManager.prototype.getSubscription = async () => (live ? (fake as never) : null);
    }, endpoint);

    const putSeen = page.waitForResponse(
      (res) => res.url().endsWith('/api/push/subscription') && res.request().method() === 'PUT',
      { timeout: 30_000 },
    );
    await loginViaDialog(page, user);
    expect((await putSeen).status(), 'PUT /api/push/subscription').toBe(204);
    expect(rowCount(), 'the subscription row exists while signed in').toBe(1);

    const deleteSeen = page.waitForResponse(
      (res) => res.url().endsWith('/api/push/subscription') && res.request().method() === 'DELETE',
      { timeout: 20_000 },
    );
    await page.locator('.nh__user-trigger').hover();
    await page.locator('.nh__dd-item--signout').click();
    const deleted = await deleteSeen;

    expect(
      await deleted.request().headerValue('authorization'),
      'the logout DELETE must carry the captured bearer token (the token is already cleared)',
    ).toMatch(/^Bearer .+/);
    expect(deleted.status(), 'logout DELETE /api/push/subscription').toBe(204);
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    expect(rowCount(), 'no orphaned PushSubscriptions row after logout').toBe(0);
  });
});
