import { expect, test } from '@playwright/test';

import {
  apiRegisterWithId,
  assertDockerStack,
  awaitRateWindow,
  loginViaDialog,
  noteRateSpend,
  API_URL,
  waitForResetTokens,
} from '../support/real-stack';

/**
 * A reset link opened while ANOTHER user is signed in (ADR-035: the reset page is deliberately
 * not behind `guestGuard`, and success "replaces the current session exactly as login does").
 *
 * The reset page dispatches `verifyEmailSuccess`; the auth state stays `isAuthenticated = true`
 * the whole time, so everything in `app.ts` that is keyed on the false->true transition of
 * `selectIsAuthenticated` (notification / chat / owner-request badge pollers and the SignalR chat
 * hub) is never restarted, and the logout-time user-scoped resets never run either. Observed live
 * 2026-10-14 (see the reproduction in the QA report): after B's reset, the chat hub websocket
 * negotiated as A stays open in B's tab (no new `/hubs/chat/negotiate`), and the badge endpoints
 * are never re-fetched with B's token. Home/listings origins were checked and do NOT leak.
 *
 * This spec asserts the CORRECT behaviour: once B is signed in, the realtime hub and the badge
 * pollers talk to the API with B's token. It is committed as `test.fixme` until frontend-dev fixes
 * the bug (the suite stays green; remove `.fixme` with the fix). It was run as a plain `test`
 * first and failed for exactly this reason.
 *
 * Budget: `auth` direct = 2 registers; `password-reset` direct = 1 forgot, proxied = check + reset.
 */
test.describe('Password reset replaces a signed-in session (real stack)', () => {
  const runId = Date.now().toString(36);
  const mk = (slug: string, phone: string) => ({
    firstName: 'Qa',
    lastName: `Swap${slug}`,
    phone: `+3749123${phone}`,
    email: `qa.swap.${slug}.${runId}@rental.local`,
    password: 'Demo1234',
  });

  // BUG (frontend): verifyEmailSuccess while authenticated does not restart the realtime hub and
  // badge pollers, nor reset user-scoped state; B inherits A's live chat connection.
  test.fixme('after B resets while A is signed in, hub and badges use B token', async ({
    page,
    request,
  }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 2);
    await awaitRateWindow('password-reset', 'direct', 1);
    await awaitRateWindow('password-reset', 'proxied', 2);

    const a = mk('a', '581');
    const b = mk('b', '582');
    await apiRegisterWithId(request, a);
    await apiRegisterWithId(request, b);

    noteRateSpend('direct', 1);
    const forgotRes = await request.post(`${API_URL}/api/auth/forgot-password`, {
      data: { email: b.email, preferredLanguage: 'en' },
      failOnStatusCode: false,
    });
    expect(forgotRes.status()).toBe(202);
    const [token] = await waitForResetTokens(b.email, 1);

    // A is signed in (token seeded from the registration, no auth spend).
    await loginViaDialog(page, a);
    const tokenA = await page.evaluate(() => localStorage.getItem('auth_token'));

    const hubAuth: string[] = [];
    const badgeAuth: string[] = [];
    let recording = false;
    page.on('request', (req) => {
      if (!recording) return;
      const auth = req.headers()['authorization'] ?? '';
      if (req.url().includes('/hubs/chat/negotiate')) hubAuth.push(auth);
      if (req.url().includes('/api/notifications/unread-count')) badgeAuth.push(auth);
    });

    // The emailed link opens in the browser that still holds A's session.
    noteRateSpend('proxied', 2);
    await page.goto(`/auth/reset-password#token=${token}`);
    const inputs = page.locator('app-reset-password-page input[type="password"]');
    await expect(inputs.first()).toBeVisible();
    await inputs.nth(0).fill('E2eReset-New1');
    await inputs.nth(1).fill('E2eReset-New1');
    recording = true;
    await page.getByTestId('reset-submit').click();
    await expect(page).toHaveURL(/\/$/);

    const tokenB = await expect
      .poll(() => page.evaluate(() => localStorage.getItem('auth_token')))
      .not.toBe(tokenA)
      .then(() => page.evaluate(() => localStorage.getItem('auth_token')));
    expect(tokenB).toBeTruthy();

    await expect
      .poll(() => hubAuth.includes(`Bearer ${tokenB}`), {
        message: 'the chat hub must be re-negotiated with the NEW user token',
        timeout: 10_000,
      })
      .toBe(true);
    await expect
      .poll(() => badgeAuth.includes(`Bearer ${tokenB}`), {
        message: 'the notification badge must be re-fetched with the NEW user token',
        timeout: 10_000,
      })
      .toBe(true);
  });
});
