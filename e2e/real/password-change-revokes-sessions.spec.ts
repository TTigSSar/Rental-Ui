import { expect, test } from '@playwright/test';

import {
  API_URL,
  apiRegister,
  assertDockerStack,
  assertLoginNotRateLimited,
  awaitRateWindow,
  loginViaDialog,
  noteAuthSpend,
} from '../support/real-stack';

/**
 * ADR-055 (JWT revocation by per-user `TokenVersion`) on the real stack. The original bug: a
 * session survived a password change, so whoever held a stolen token kept access after the owner
 * rotated their password. Nothing below the real API + SQL Server can prove the revocation: the
 * mocked tier answers its own contract by construction (M-020).
 *
 * Two independent sessions of ONE user (two real logins, two distinct JWTs):
 *   A - a browser tab driven through the real UI;
 *   B - a separate API-only session (a "stolen / other-device" token).
 * Changing the password in A must (1) keep A signed in on the fresh token the change returns,
 * (2) make B's very next authenticated call a bare 401 (and the old A token too), and (3) make
 * A's tab restart its chat hub (server aborts the user's hub connections; the tab reconnects
 * ~2 s later, Rental-Ui 33d17be) - observed as a NEW `/hubs/chat` WebSocket.
 *
 * Account: a THROWAWAY registered user, never a seeded one - the spec rotates its credential, and
 * a throwaway needs no restore (rerunnable by construction, no order dependence). Budget:
 * `auth` direct = 1 register + 1 login (B); `password-change` proxied = 1 (the UI submit).
 */
test.describe('Password change revokes other sessions (real stack, ADR-055)', () => {
  const runId = Date.now().toString(36);
  const user = {
    firstName: 'Qa',
    lastName: 'Revoke',
    phone: '+37491235890',
    email: `qa.revoke.${runId}@rental.local`,
    password: 'Demo1234',
  };
  const NEW_PASSWORD = 'E2eRevoke-New1';

  test('A stays signed in and reconnects its hub; B and the old token get 401', async ({
    page,
    request,
  }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 2);

    // Session A's token (also cached for loginViaDialog, so the tab signs in without a login).
    const tokenA = await apiRegister(request, user);

    // Session B: a genuinely separate login -> its own JWT, same TokenVersion.
    noteAuthSpend('direct', `second session login ${user.email}`);
    const loginB = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: user.email, password: user.password },
      failOnStatusCode: false,
    });
    assertLoginNotRateLimited(loginB.status(), user.email);
    expect(loginB.ok(), `second login failed: ${loginB.status()}`).toBe(true);
    const tokenB = ((await loginB.json()) as { accessToken: string }).accessToken;
    expect(tokenB).toBeTruthy();
    expect(tokenB, 'B must be an independent session, not A re-used').not.toBe(tokenA);

    const me = (token: string) =>
      request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      });
    expect((await me(tokenA)).status(), 'A authenticates before the change').toBe(200);
    expect((await me(tokenB)).status(), 'B authenticates before the change').toBe(200);

    const hubSockets: string[] = [];
    page.on('websocket', (ws) => {
      if (ws.url().includes('/hubs/chat')) hubSockets.push(ws.url());
    });

    await loginViaDialog(page, user);
    await expect
      .poll(() => hubSockets.length, {
        message: 'the signed-in tab must open its chat hub WebSocket before the change',
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(1);
    const socketsBefore = hubSockets.length;

    await page.goto('/profile/security');
    const form = page.locator('form.security-page__form');
    await form.locator('input.uii-native').nth(0).fill(user.password);
    await form.locator('input.uii-native').nth(1).fill(NEW_PASSWORD);
    await form.locator('input.uii-native').nth(2).fill(NEW_PASSWORD);
    const [changeRes] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith('/api/auth/me/password') && res.request().method() === 'PUT',
        { timeout: 20_000 },
      ),
      form.locator('button[type="submit"]').click(),
    ]);
    expect(changeRes.status(), await changeRes.text().catch(() => '')).toBe(200);

    // (1) A keeps a working session on the fresh token.
    const freshA = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(freshA, 'A must hold a fresh token after the change').toBeTruthy();
    expect(freshA).not.toBe(tokenA);
    expect((await me(freshA!)).status(), 'A (fresh token) must stay authenticated').toBe(200);

    // (2) every other session is revoked: bare 401 on the next authenticated call.
    const revokedB = await me(tokenB);
    expect(revokedB.status(), 'B must be revoked by the password change').toBe(401);
    expect(await revokedB.text(), 'revocation is a bare 401, no body').toBe('');
    expect((await me(tokenA)).status(), "A's pre-change token must be revoked too").toBe(401);

    // (3) the server aborted the user's hub connections; A's tab restarts its hub (~2 s later).
    await expect
      .poll(() => hubSockets.length, {
        message: "A's tab must open a NEW /hubs/chat WebSocket after the password change",
        timeout: 15_000,
      })
      .toBeGreaterThan(socketsBefore);

    // The tab itself is still signed in (no bounce to '/').
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile$/);
  });
});
