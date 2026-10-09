import { expect, test, type Page } from '@playwright/test';

import { mockApi, type ApiSeed } from './support/api-mock';
import { e2eUser } from './support/fixtures';

/**
 * Critical journey (ADR-028): the landing page of the confirmation email,
 * `/auth/verify-email#token=…`. Four contracts, each of which silently degrades
 * into a security or support problem if it regresses:
 *  - the token leaves the address bar at once and NOTHING is posted on load
 *    (mail scanners and link previews must not burn it);
 *  - success needs the password, signs the user in and lands on a fixed route;
 *  - a wrong password keeps the link usable (retry), an expired link offers a resend;
 *  - a page reload (no fragment any more) tells the user to re-open the email link.
 */
const TOKEN = 'dGhpcy1pcy1hLTQzLWNoYXItYmFzZTY0dXJsLXRva2VuLXh4eHg';
const VERIFY_PATH = '/auth/verify-email';

const passwordInput = (page: Page) => page.locator('app-verify-email-page input[type="password"]');

function trackPosts(page: Page, endpoint: string): { bodies: Record<string, unknown>[] } {
  const bodies: Record<string, unknown>[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith(endpoint) && req.method() === 'POST') {
      bodies.push(req.postDataJSON() as Record<string, unknown>);
    }
  });
  return { bodies };
}

async function openLink(page: Page, seed: ApiSeed = {}): Promise<void> {
  await mockApi(page, seed);
  await page.goto(`${VERIFY_PATH}#token=${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible();
}

test.describe('Verify email page', () => {
  test('strips the token from the URL, posts nothing on load, then verifies with the password and signs in', async ({
    page,
  }) => {
    const verify = trackPosts(page, '/api/auth/verify-email');
    await openLink(page, { me: e2eUser() });

    // Gone from the address bar (and so from history) as soon as the page is up.
    await expect(page).toHaveURL(new RegExp(`${VERIFY_PATH}$`));
    expect(page.url()).not.toContain(TOKEN);
    expect(verify.bodies).toHaveLength(0);

    await passwordInput(page).fill('Password1!');
    await page.getByRole('button', { name: 'Confirm email' }).click();

    // The token that was in the fragment is what was posted, with the password.
    await expect.poll(() => verify.bodies.length).toBe(1);
    expect(verify.bodies[0]).toEqual({ token: TOKEN, password: 'Password1!' });

    // Auto-login + FIXED landing route (home), never a returnUrl.
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => window.localStorage.getItem('auth_token'))).toBe(
      'e2e-jwt-token',
    );
    // The token never lands in web storage.
    expect(await page.evaluate(() => JSON.stringify({ ...window.localStorage }))).not.toContain(
      TOKEN,
    );
  });

  test('a wrong password says so and keeps the link usable; the right one then succeeds', async ({
    page,
  }) => {
    const verify = trackPosts(page, '/api/auth/verify-email');
    await openLink(page, { me: e2eUser(), verifyEmail: { password: 'Password1!' } });

    await passwordInput(page).fill('not-my-password');
    await page.getByRole('button', { name: 'Confirm email' }).click();

    await expect(page.getByTestId('verify-error')).toContainText('Wrong password');
    // Still on the form: the token was not consumed, so the user can retry.
    await expect(passwordInput(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${VERIFY_PATH}$`));

    await passwordInput(page).fill('Password1!');
    await page.getByRole('button', { name: 'Confirm email' }).click();

    await expect(page).toHaveURL(/\/$/);
    // Same token both times.
    expect(verify.bodies.map((b) => b['token'])).toEqual([TOKEN, TOKEN]);
  });

  test('an expired link explains itself and offers a resend', async ({ page }) => {
    const resend = trackPosts(page, '/api/auth/resend-verification');
    await openLink(page, {
      verifyEmail: {
        status: 400,
        body: {
          type: 'urn:rental:error:auth.verification_token_expired',
          title: 'Verification link expired',
          status: 400,
          errorCode: 'auth.verification_token_expired',
        },
      },
    });

    await passwordInput(page).fill('Password1!');
    await page.getByRole('button', { name: 'Confirm email' }).click();

    await expect(page.getByTestId('verify-error')).toContainText('This link has expired');
    // The password form is gone — the link cannot be used any more.
    await expect(passwordInput(page)).toHaveCount(0);

    await page.locator('app-verify-email-page input[type="email"]').fill('anna.p@gmail.com');
    await page.getByRole('button', { name: 'Resend email' }).click();

    await expect.poll(() => resend.bodies.length).toBe(1);
    expect(resend.bodies[0]).toEqual({ email: 'anna.p@gmail.com' });
    await expect(page.locator('.resend-verification__status')).toContainText('new link is on its way');
    // 60 s countdown starts.
    await expect(page.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  });

  test('without a token (e.g. after a reload) it asks to open the email link again', async ({
    page,
  }) => {
    await mockApi(page);
    await page.goto(VERIFY_PATH);

    await expect(page.getByTestId('verify-no-token')).toContainText(
      'Open the link from your email again',
    );
    await expect(passwordInput(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resend email' })).toBeVisible();
  });

  test('an already-confirmed account is told to log in and the login dialog opens', async ({
    page,
  }) => {
    await openLink(page, {
      verifyEmail: {
        status: 409,
        body: {
          type: 'urn:rental:error:auth.email_already_verified',
          title: 'Email already verified',
          status: 409,
          errorCode: 'auth.email_already_verified',
        },
      },
    });

    await passwordInput(page).fill('Password1!');
    await page.getByRole('button', { name: 'Confirm email' }).click();

    await expect(page.getByTestId('verify-error')).toContainText('Email already confirmed');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sign in' })).toBeVisible();
  });
});
