import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';

/**
 * Critical journeys (ADR-035): password reset by an emailed link. Mocked tier - the three
 * endpoints are stubbed by `support/api-mock.ts`; this pins the FRONTEND wiring only (what is
 * sent, which state is shown, that the token leaves the address bar and the session is stored).
 */
const TOKEN = 'dGhpcy1pcy1hLTQzLWNoYXItYmFzZTY0dXJsLXRva2VuLXh4eHg';
const RESET_PATH = '/auth/reset-password';

function trackPosts(page: Page, endpoint: string): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith(endpoint) && req.method() === 'POST') {
      bodies.push(req.postDataJSON() as Record<string, unknown>);
    }
  });
  return { bodies };
}

test.describe('Forgot password (ADR-035)', () => {
  test('Sign in dialog -> Forgot password? -> request -> Check your email', async ({ page }) => {
    const forgot = trackPosts(page, '/api/auth/forgot-password');
    await mockApi(page);

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type="email"]').fill('anna.p@gmail.com');
    await dialog.getByRole('button', { name: 'Forgot password?' }).click();

    // Request step: the typed address is carried over, the tabs are gone.
    await expect(dialog.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    await expect(dialog.locator('input[type="email"]')).toHaveValue('anna.p@gmail.com');

    await dialog.getByRole('button', { name: 'Send link' }).click();

    await expect(dialog.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(dialog.getByTestId('fp-check-text')).toContainText('anna.p@gmail.com');
    // The 60 s countdown is plain text, not a button.
    await expect(dialog.getByTestId('fp-countdown')).toContainText(/\d:\d\d/);
    await expect(dialog.getByRole('button', { name: 'Send again' })).toHaveCount(0);

    expect(forgot.bodies).toEqual([{ email: 'anna.p@gmail.com', preferredLanguage: 'en' }]);
  });

  test('/auth/reset-password#token=... -> check 204 -> set password -> home, signed in', async ({
    page,
  }) => {
    const check = trackPosts(page, '/api/auth/reset-password/check');
    const reset = trackPosts(page, '/api/auth/reset-password');
    await mockApi(page, { me: e2eUser() });

    await page.goto(`${RESET_PATH}#token=${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();

    // The token left the address bar at once and was checked (read-only) on load.
    await expect(page).toHaveURL(new RegExp(`${RESET_PATH}$`));
    expect(page.url()).not.toContain(TOKEN);
    await expect.poll(() => check.bodies.length).toBe(1);
    expect(check.bodies[0]).toEqual({ token: TOKEN });
    expect(reset.bodies).toHaveLength(0);

    const fields = page.locator('app-reset-password-page input[type="password"]');
    await fields.nth(0).fill('Password1!');
    await fields.nth(1).fill('Password1!');
    await page.getByRole('button', { name: 'Set password' }).click();

    await expect.poll(() => reset.bodies.length).toBe(1);
    expect(reset.bodies[0]).toEqual({ token: TOKEN, newPassword: 'Password1!' });
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => window.localStorage.getItem('auth_token'))).toBe(
      'e2e-jwt-token',
    );
    // The token never lands in web storage.
    expect(await page.evaluate(() => JSON.stringify({ ...window.localStorage }))).not.toContain(
      TOKEN,
    );
  });

  test('an expired link says so and "Request a new link" opens the Request step with an empty, focused field', async ({
    page,
  }) => {
    await mockApi(page, {
      resetPasswordCheck: {
        status: 400,
        body: {
          type: 'urn:rental:error:auth.reset_token_expired',
          title: 'Reset link expired',
          status: 400,
          errorCode: 'auth.reset_token_expired',
        },
      },
    });

    await page.goto(`${RESET_PATH}#token=${TOKEN}`);
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
    await expect(page.locator('app-reset-password-page input')).toHaveCount(0);

    await page.getByRole('button', { name: 'Request a new link' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    const email = dialog.locator('input[type="email"]');
    await expect(email).toHaveValue('');
    await expect(email).toBeFocused();
    // The marker is dropped so a reload does not reopen the dialog.
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Reset link opened while another user is signed in', () => {
  test('B inherits nothing of A: badge pollers restart with the new token', async ({ page }) => {
    await mockApi(page, {
      me: e2eUser({ id: 'user-a', firstName: 'Alice' }),
      resetPassword: { body: { token: 'tok-b' } },
    });
    // Later-registered routes win: answer /auth/me per bearer token, like the real API.
    await page.route('**/api/auth/me', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const bearer = route.request().headers()['authorization'] ?? '';
      const user =
        bearer === 'Bearer tok-b'
          ? e2eUser({ id: 'user-b', firstName: 'Boris' })
          : e2eUser({ id: 'user-a', firstName: 'Alice' });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
    });
    await page.addInitScript(() => {
      if (!window.localStorage.getItem('auth_token')) {
        window.localStorage.setItem('auth_token', 'tok-a');
      }
    });

    const badgeAuth: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/notifications/unread-count')) {
        badgeAuth.push(req.headers()['authorization'] ?? '');
      }
    });

    await page.goto(`${RESET_PATH}#token=${TOKEN}`);
    await expect.poll(() => badgeAuth).toContain('Bearer tok-a');

    const fields = page.locator('app-reset-password-page input[type="password"]');
    await fields.nth(0).fill('Password1!');
    await fields.nth(1).fill('Password1!');
    await page.getByRole('button', { name: 'Set password' }).click();

    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => window.localStorage.getItem('auth_token'))).toBe('tok-b');
    // The poller was torn down and restarted for B: it re-fetched with B's token.
    await expect.poll(() => badgeAuth).toContain('Bearer tok-b');
  });
});
