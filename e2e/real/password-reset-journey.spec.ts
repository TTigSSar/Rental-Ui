import { expect, test } from '@playwright/test';

import {
  API_URL,
  apiRegister,
  assertDockerStack,
  assertLoginNotRateLimited,
  awaitRateWindow,
  noteAuthSpend,
  noteRateSpend,
  waitForResetTokens,
} from '../support/real-stack';

/**
 * Password reset (ADR-035), end to end on the real stack.
 *
 * Why real-stack: the guarantee is that a forgotten password can be replaced by proving the
 * mailbox, and every link of that chain crosses a layer the cheaper tiers fake. The mocked tier
 * hand-writes the 202/204/200/400 bodies; backend tests run on SQLite and a stubbed sender. Only
 * here are the real forgot-password (always 202), the real token written to `UserTokens`, the
 * real link produced by `LoggingEmailSender`, the real read-only check (204), the real one-shot
 * reset against SQL Server, and the real BCrypt login round trip proving the credential changed.
 *
 * The link is read from the api container log (`waitForResetTokens`): ADR-028/035 forbid a test
 * endpoint that returns tokens, and a DB write would skip the flow under test.
 *
 * Budget (M-044, see e2e/README.md): `auth` direct = 1 register + 2 login probes; `password-reset`
 * proxied = forgot (UI) + check + reset + check on reopen = 4. `awaitRateWindow` waits for a fresh
 * window if the earlier specs of the run left too little (the one stated reason for a wait here).
 */
test.describe('Password reset journey (real stack)', () => {
  const runId = Date.now().toString(36);
  const oldPassword = 'Demo1234';
  const newPassword = 'E2eReset-New1';
  const user = {
    firstName: 'Qa',
    lastName: 'Reset',
    phone: '+37491234570',
    email: `qa.reset.${runId}@rental.local`,
    password: oldPassword,
  };

  test('forgot -> link -> check -> new password -> signed in; old fails, new works, link is one-shot', async ({
    page,
    request,
  }) => {
    await assertDockerStack(request);

    await awaitRateWindow('auth', 'direct', 3);
    await awaitRateWindow('password-reset', 'proxied', 4);

    await test.step('fixture: a verified throwaway user', async () => {
      await apiRegister(request, user);
    });

    await test.step('forgot-password through the real dialog answers 202 and shows "Check your email"', async () => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.getByTestId('forgot-password').click();
      const request$ = page.getByTestId('fp-request');
      await request$.locator('input').fill(user.email);

      noteRateSpend('proxied', 1);
      const [res] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().endsWith('/api/auth/forgot-password') && r.request().method() === 'POST',
        ),
        page.getByTestId('fp-submit').click(),
      ]);
      expect(res.status()).toBe(202);
      await expect(page.getByTestId('fp-check')).toBeVisible();
    });

    const [token] = await waitForResetTokens(user.email, 1);

    await test.step('opening the link strips the token, checks it read-only (204) and shows the form', async () => {
      noteRateSpend('proxied', 1);
      const [checkRes] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/auth/reset-password/check') && r.request().method() === 'POST',
        ),
        page.goto(`/auth/reset-password#token=${token}`),
      ]);
      expect(checkRes.status()).toBe(204);
      await expect(page).toHaveURL(/\/auth\/reset-password$/);
      expect(page.url()).not.toContain(token);
      await expect(page.getByTestId('reset-submit')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    });

    await test.step('setting the new password signs the user in on the home page', async () => {
      const inputs = page.locator('app-reset-password-page input[type="password"]');
      await inputs.nth(0).fill(newPassword);
      await inputs.nth(1).fill(newPassword);

      noteRateSpend('proxied', 1);
      const [resetRes] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().endsWith('/api/auth/reset-password') && r.request().method() === 'POST',
          { timeout: 20_000 },
        ),
        page.getByTestId('reset-submit').click(),
      ]);
      expect(resetRes.status()).toBe(200);
      await expect(page).toHaveURL(/\/$/);

      const jwt = await expect
        .poll(() => page.evaluate(() => localStorage.getItem('auth_token')))
        .toBeTruthy()
        .then(() => page.evaluate(() => localStorage.getItem('auth_token')));
      const me = await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(me.ok()).toBe(true);
      expect(((await me.json()) as { email: string }).email).toBe(user.email);
    });

    await test.step('the old password is rejected and the new one accepted by a real login', async () => {
      noteAuthSpend('direct', `old-password-rejected probe ${user.email}`);
      const oldRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: oldPassword },
        failOnStatusCode: false,
      });
      assertLoginNotRateLimited(oldRes.status(), user.email);
      expect(oldRes.status(), 'the pre-reset password must be rejected').toBe(401);

      noteAuthSpend('direct', `new-password-accepted probe ${user.email}`);
      const newRes = await request.post(`${API_URL}/api/auth/login`, {
        data: { email: user.email, password: newPassword },
        failOnStatusCode: false,
      });
      assertLoginNotRateLimited(newRes.status(), user.email);
      expect(newRes.status(), 'the new password must be accepted').toBe(200);
    });

    await test.step('re-opening the same link shows the invalid-link state', async () => {
      noteRateSpend('proxied', 1);
      const [checkRes] = await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().endsWith('/api/auth/reset-password/check') && r.request().method() === 'POST',
        ),
        page.goto(`/auth/reset-password#token=${token}`),
      ]);
      expect(checkRes.status()).toBe(400);
      expect(((await checkRes.json()) as { errorCode?: string }).errorCode).toBe(
        'auth.reset_token_invalid',
      );
      await expect(page.getByTestId('reset-invalid')).toBeVisible();
    });
  });
});
