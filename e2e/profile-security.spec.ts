import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';

/**
 * Critical journey: change password (ADR-021), `/profile/security` — the first
 * child route owned by the `profile` feature itself. A separate file from
 * `auth.spec.ts` (which is scoped to the header login dialog only): this
 * journey needs an authenticated session and navigates from a profile
 * settings row, a different setup shape entirely.
 *
 * Mocked tier — the network-level stub (`support/api-mock.ts`) answers
 * `PUT /api/auth/me/password`. This pins the FRONTEND's wiring only: routing
 * to /profile/security and `security-page.component.ts`'s field-vs-banner
 * error mapping (see its class doc comment). It cannot prove a password
 * actually changed on a real backend — that is `real/change-password.spec.ts`
 * (M-020: a mock that answers its own contract proves nothing about the real
 * one).
 */
test.describe('Change password', () => {
  test.beforeEach(async ({ page }) => {
    // Seed a token before the app boots so initAuth$ hydrates the session and the `profile`
    // route's authGuard admits it — same convention as admin-moderation.spec.ts etc.
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('reaches /profile/security from a profile settings row and submits successfully', async ({
    page,
  }) => {
    await mockApi(page, { me: e2eUser() });

    await page.goto('/profile');
    // Selector convention: stable CSS hook, not text (translated) or a
    // data-testid. All three settings surfaces link here via a plain
    // (non-bound) `routerLink` attribute, so this matches whichever is
    // rendered at the current viewport; `.first()` picks the desktop sidebar
    // item since it renders outside the `isChildRouteActive()` toggle.
    await page.locator('a[routerLink="/profile/security"]').first().click();
    await expect(page).toHaveURL(/\/profile\/security$/);

    const form = page.locator('form.security-page__form');
    await form.locator('input.uii-native').nth(0).fill('OldPassword1');
    await form.locator('input.uii-native').nth(1).fill('NewPassword1');
    await form.locator('input.uii-native').nth(2).fill('NewPassword1');
    await form.locator('button[type="submit"]').click();

    // exact: true — the persistent live region (`role="status"`, mounted from first paint per
    // the component's doc comment) now ALSO contains "Password updated" as a substring of its
    // longer announcement text, so a non-exact match resolves to two elements (strict-mode
    // violation). The exact match pins this assertion to the visible success title specifically.
    await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
  });

  test('a forced 400 auth.invalid_current_password lands as a field-level error, not a banner', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eUser(),
      changePassword: { status: 400, body: { errorCode: 'auth.invalid_current_password' } },
    });

    await page.goto('/profile/security');

    const form = page.locator('form.security-page__form');
    await form.locator('input.uii-native').nth(0).fill('WrongPassword1');
    await form.locator('input.uii-native').nth(1).fill('NewPassword1');
    await form.locator('input.uii-native').nth(2).fill('NewPassword1');
    await form.locator('button[type="submit"]').click();

    await expect(page.getByText('Current password is incorrect.')).toBeVisible();
    // Must land under the current-password field, never as the form banner.
    await expect(page.locator('.security-page__banner')).toHaveCount(0);
  });

  test('a forced 429 lands as the form-level banner', async ({ page }) => {
    await mockApi(page, {
      me: e2eUser(),
      changePassword: { status: 429, body: {} },
    });

    await page.goto('/profile/security');

    const form = page.locator('form.security-page__form');
    await form.locator('input.uii-native').nth(0).fill('OldPassword1');
    await form.locator('input.uii-native').nth(1).fill('NewPassword1');
    await form.locator('input.uii-native').nth(2).fill('NewPassword1');
    await form.locator('button[type="submit"]').click();

    await expect(page.locator('.security-page__banner')).toContainText(
      'Too many attempts, try again in a minute.',
    );
  });
});
