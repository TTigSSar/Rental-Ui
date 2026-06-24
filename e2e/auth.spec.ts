import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';

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
      login: { status: 400, body: { detail: 'Invalid email or password' } },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();

    const form = page.locator('form.auth-form');
    await form.locator('input.uii-native').nth(0).fill('user@example.com');
    await form.locator('input.uii-native').nth(1).fill('wrongpassword');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('Invalid email or password')).toBeVisible();
  });
});
