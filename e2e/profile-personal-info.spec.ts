import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';
import { callsTo, recordCalls } from './support/google-stub';

/**
 * Critical journey: the profile "Personal info" card (ADR-030 sections 5 and 8) - first name,
 * optional last name and phone are editable in place. A name save is `PUT /api/auth/me/name`;
 * the phone is a second request, sent ONLY when it changed (an unchanged phone must not burn
 * the 10/hour per-user budget). Mocked tier: wiring and request bodies only.
 */
test.describe('Profile - Personal info card', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  const user = () =>
    e2eUser({ firstName: 'Ada', lastName: 'Lovelace', phoneNumber: '+374 99 123 456' });

  test('view mode shows the saved values; editing name and phone sends both PUTs and confirms', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, { me: user() });
    await page.goto('/profile');

    const card = page.getByTestId('personal-info-card');
    await expect(card).toBeVisible();
    // View mode shows only Phone and Email - no Name row; the name lives in the identity header.
    await expect(card).not.toContainText('Ada');
    await expect(card).not.toContainText('Lovelace');
    await expect(card).toContainText('+374 99 123 456');
    await expect(card).toContainText('user@example.com');
    const identityName = page.locator('.profile-page__identity-name');
    await expect(identityName).toHaveText('Ada Lovelace');

    await card.getByTestId('personal-info-edit').click();
    const inputs = card.locator('input.uii-native');
    await expect(inputs.nth(0)).toHaveValue('Ada');
    await expect(inputs.nth(1)).toHaveValue('Lovelace');
    await expect(inputs.nth(2)).toHaveValue('+374 99 123 456');
    await inputs.nth(0).fill('  Grace ');
    await inputs.nth(1).fill('Hopper');
    await inputs.nth(2).fill('+374 77 000 111');
    await card.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('Personal info saved')).toBeVisible();
    await expect(identityName).toHaveText('Grace Hopper');
    await expect(card).not.toContainText('Grace');
    await expect(card).toContainText('+374 77 000 111');

    const names = callsTo(calls, 'PUT', '/api/auth/me/name');
    const phones = callsTo(calls, 'PUT', '/api/auth/me/phone');
    expect(names).toHaveLength(1);
    expect(names[0].body).toEqual({ firstName: 'Grace', lastName: 'Hopper' });
    expect(phones).toHaveLength(1);
    expect(phones[0].body).toEqual({ phoneNumber: '+374 77 000 111' });
  });

  test('an unchanged phone is not re-sent: only PUT name goes out', async ({ page }) => {
    const calls = recordCalls(page);
    await mockApi(page, { me: user() });
    await page.goto('/profile');

    const card = page.getByTestId('personal-info-card');
    await card.getByTestId('personal-info-edit').click();
    await card.locator('input.uii-native').nth(0).fill('Grace');
    await card.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(page.getByText('Personal info saved')).toBeVisible();
    expect(callsTo(calls, 'PUT', '/api/auth/me/name')).toHaveLength(1);
    expect(callsTo(calls, 'PUT', '/api/auth/me/name')[0].body).toEqual({
      firstName: 'Grace',
      lastName: 'Lovelace',
    });
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(0);
  });

  test('an invalid phone shows the field error and sends nothing', async ({ page }) => {
    const calls = recordCalls(page);
    await mockApi(page, { me: user() });
    await page.goto('/profile');

    const card = page.getByTestId('personal-info-card');
    await card.getByTestId('personal-info-edit').click();
    await card.locator('input.uii-native').nth(2).fill('abc');
    await card.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(card).toContainText('Enter a valid phone number');
    // Still in edit mode, nothing written.
    await expect(card.locator('input.uii-native').nth(2)).toHaveValue('abc');
    expect(callsTo(calls, 'PUT', '/api/auth/me/name')).toHaveLength(0);
    expect(callsTo(calls, 'PUT', '/api/auth/me/phone')).toHaveLength(0);
  });
});
