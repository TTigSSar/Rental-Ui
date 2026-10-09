import { expect, test } from '@playwright/test';

import {
  API_URL,
  apiRegisterUnverified,
  assertDockerStack,
  assertLoginNotRateLimited,
  noteAuthSpend,
  readVerificationToken,
} from '../support/real-stack';

/**
 * Hard email verification (ADR-028), end to end on the real stack.
 *
 * Why this has to be real-stack: the guarantee is that NO session exists until the owner of the
 * mailbox proves it, and every link of that chain crosses a layer the cheaper tiers fake. The
 * mocked tier hand-writes the 201/403/409 bodies (`api-mock.ts`); backend tests run on SQLite and
 * a stubbed sender. Only here are the real register (no token), the real login gate
 * (`auth.email_not_verified`), the real token issued into `UserTokens`, the real link produced by
 * `LoggingEmailSender`, and the real one-shot consumption (second use -> 409) in one chain.
 *
 * The link is read from the api container log (`readVerificationToken`): ADR-028 forbids a test
 * endpoint that returns tokens, and a DB write that marks the user verified would skip the very
 * flow under test.
 *
 * The "Check your email" step of the sign-up dialog is asserted by `home-point-journey.spec.ts`
 * (it registers through the real dialog); this journey registers Node-side so that its auth
 * spend is one register (`direct`) + one login attempt (`proxied`), see `e2e/README.md`'s budget.
 * verify-email has its own 10/min `email-verification` policy and costs nothing from `auth`.
 */
test.describe('Email verification journey (real stack)', () => {
  const runId = Date.now().toString(36);
  const user = {
    firstName: 'Qa',
    lastName: 'Verify',
    phone: '+37491234569',
    email: `qa.verify.${runId}@rental.local`,
    password: 'Demo1234',
  };

  test('register gives no session, login is refused until the link is opened, the link is one-shot', async ({
    page,
    request,
  }) => {
    await test.step('guard: docker stack is what is actually serving :4200/:8080', async () => {
      await assertDockerStack(request);
    });

    await test.step('register: accepted, but no session', async () => {
      await apiRegisterUnverified(request, user);
    });

    await test.step('a login attempt before confirming is refused with "Email not confirmed"', async () => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Log in' }).click();
      const form = page.locator('form.auth-form');
      await form.locator('input.uii-native').nth(0).fill(user.email);
      await form.locator('input.uii-native').nth(1).fill(user.password);

      // Browser-originated -> nginx -> `proxied` bucket (support/real-stack.ts).
      noteAuthSpend('proxied', `login attempt before verification ${user.email}`);
      const [loginResponse] = await Promise.all([
        page.waitForResponse(
          (res) => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST',
        ),
        form.locator('button[type="submit"]').click(),
      ]);
      assertLoginNotRateLimited(loginResponse.status(), user.email);
      expect(loginResponse.status()).toBe(403);
      expect(((await loginResponse.json()) as { errorCode?: string }).errorCode).toBe(
        'auth.email_not_verified',
      );

      await expect(page.getByTestId('email-not-verified')).toContainText('Email not confirmed');
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    });

    const token = await readVerificationToken(user.email);
    const verifyPosts: number[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/verify-email') && req.method() === 'POST') {
        verifyPosts.push(1);
      }
    });
    const passwordInput = page.locator('app-verify-email-page input[type="password"]');

    await test.step('opening the link strips the token from the URL and posts nothing yet', async () => {
      await page.goto(`/auth/verify-email#token=${token}`);
      await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible();
      await expect(page).toHaveURL(/\/auth\/verify-email$/);
      expect(page.url()).not.toContain(token);
      expect(verifyPosts).toHaveLength(0);
    });

    await test.step('a wrong password is refused and the link stays usable', async () => {
      await passwordInput.fill('Not-my-password-1');
      await page.getByRole('button', { name: 'Confirm email' }).click();
      await expect(page.getByTestId('verify-error')).toContainText('Wrong password');
      await expect(passwordInput).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    });

    await test.step('the right password confirms the email and signs in', async () => {
      await passwordInput.fill(user.password);
      await page.getByRole('button', { name: 'Confirm email' }).click();
      await expect(page).toHaveURL(/\/$/);
      const jwt = await expect
        .poll(() => page.evaluate(() => localStorage.getItem('auth_token')))
        .toBeTruthy()
        .then(() => page.evaluate(() => localStorage.getItem('auth_token')));

      // The session is real: /me on the real API answers for this very account.
      const me = await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(me.ok()).toBe(true);
      expect(((await me.json()) as { email: string }).email).toBe(user.email);
    });

    await test.step('re-opening the same link says the email is already confirmed', async () => {
      await page.goto(`/auth/verify-email#token=${token}`);
      await expect(passwordInput).toBeVisible();
      await passwordInput.fill(user.password);
      await page.getByRole('button', { name: 'Confirm email' }).click();
      await expect(page.getByTestId('verify-error')).toContainText('Email already confirmed');
    });
  });
});
