import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';
import { enText } from './support/i18n';

/**
 * Critical journey: log in. Login is driven by the auth dialog opened from the
 * header "Log in" button (there is no standalone /auth/login route). Covers the
 * happy path (dialog closes once /auth/me resolves) and the failure path (bad
 * credentials surface an error and the dialog stays open).
 */
test.describe('Login', () => {
  test('signs in with valid credentials', async ({ page }) => {
    await mockApi(page, { login: { token: 'e2e-jwt-token' }, me: e2eUser() });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('supersecret');
    await form.locator('button[type="submit"]').click();

    // On success the dialog closes once the session is hydrated.
    await expect(form).toBeHidden();
  });

  test('shows an error message on rejected credentials', async ({ page }) => {
    await mockApi(page, {
      login: {
        status: 400,
        body: {
          type: 'urn:rental:error:auth.invalid_credentials',
          title: 'Invalid email or password',
          status: 400,
          detail: 'Invalid email or password',
          errorCode: 'auth.invalid_credentials',
        },
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('wrongpassword');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(enText('errors.invalidCredentials'))).toBeVisible();
    await expect(page.getByText('Invalid email or password')).toHaveCount(0);
  });

  // ADR-028: 403 `auth.email_not_verified` and 403 `auth.user_blocked` share a status;
  // only the errorCode tells them apart, and only the first gets a resend.
  test('an unconfirmed account sees "Email not confirmed" with a resend button', async ({
    page,
  }) => {
    await mockApi(page, {
      login: {
        status: 403,
        body: {
          type: 'urn:rental:error:auth.email_not_verified',
          title: 'Email not verified',
          status: 403,
          errorCode: 'auth.email_not_verified',
        },
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('supersecret');
    await form.locator('button[type="submit"]').click();

    const notice = page.getByTestId('email-not-verified');
    await expect(notice).toContainText('Email not confirmed');

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/resend-verification') && req.method() === 'POST',
      ),
      page.getByRole('button', { name: 'Resend email' }).click(),
    ]);
    expect(request.postDataJSON()).toEqual({ email: 'user@example.com' });
    await expect(page.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  });

  test('a blocked account keeps the plain error banner, no resend', async ({ page }) => {
    await mockApi(page, {
      login: {
        status: 403,
        body: {
          type: 'urn:rental:error:auth.user_blocked',
          title: 'User is blocked',
          status: 403,
          errorCode: 'auth.user_blocked',
        },
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('supersecret');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(enText('errors.userBlocked'))).toBeVisible();
    await expect(page.getByText('User is blocked')).toHaveCount(0);
    await expect(page.getByTestId('email-not-verified')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Resend email' })).toHaveCount(0);
  });

  // ADR-045 regression: a 500 whose ProblemDetails carried a C# stack trace (file paths) used to be
  // rendered verbatim in the banner. Only the translated generic server text may reach the page.
  test('a 500 with a stack trace in the body shows only the generic server text', async ({
    page,
  }) => {
    const trace =
      'at RentalPlatform.Application.Auth.LoginHandler.Handle() in C:\\src\\RentalPlatform\\LoginHandler.cs:line 42';
    await mockApi(page, {
      login: {
        status: 500,
        body: {
          title: 'System.InvalidOperationException: boom',
          status: 500,
          detail: trace,
          errors: { '': [trace] },
        },
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('supersecret');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText(enText('errors.server'))).toBeVisible();
    for (const fragment of ['RentalPlatform', 'LoginHandler', 'C:\\', 'InvalidOperationException']) {
      await expect(page.getByText(fragment)).toHaveCount(0);
    }
  });
});
