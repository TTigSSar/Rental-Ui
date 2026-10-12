import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { e2eUser } from './support/fixtures';
import { mockTiles } from './support/tile-mock';
import {
  callsTo,
  expectRenders,
  fakeGoogleCredential,
  fireGoogleCredential,
  gsiState,
  installGoogleStub,
  recordCalls,
} from './support/google-stub';

/**
 * Critical journeys: Google sign-in v1 (ADR-030). Mocked tier - Google Identity Services is
 * replaced by a recorder (`support/google-stub.ts`) and the backend by `api-mock.ts`, so this
 * pins the FRONTEND's wiring only: the nonce lifecycle, what `/external` is sent, and how each
 * server answer is shown. Whether the real server accepts the token/nonce is the xUnit side;
 * whether real Google issues one needs a human and a real client id (manual check).
 */
const CREDENTIAL_EMAIL = 'anna.p@yahoo.com';

function credential(nonce = 'e2e-nonce-1'): string {
  return fakeGoogleCredential({ email: CREDENTIAL_EMAIL, nonce, given_name: 'Anna' });
}

async function openLogin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.gsi-block')).toBeVisible();
}

test.describe('Google sign-in (ADR-030)', () => {
  test.beforeEach(async ({ page }) => {
    await installGoogleStub(page);
  });

  // Journey 1
  test('opening the dialog requests a nonce, initializes GIS with it and renders the button into an emptied container', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, {});

    await openLogin(page);
    await expectRenders(page, 1);

    expect(callsTo(calls, 'POST', '/api/auth/external/nonce')).toHaveLength(1);
    // Nothing was sent to /external just by opening the dialog.
    expect(callsTo(calls, 'POST', '/api/auth/external')).toHaveLength(0);

    const gsi = await gsiState(page);
    // initialize and render always come together, in that order, with the SERVER's nonce.
    expect(gsi.events).toEqual(['initialize:e2e-nonce-1', 'render']);
    expect(gsi.inits).toHaveLength(1);
    expect(gsi.inits[0].nonce).toBe('e2e-nonce-1');
    expect(gsi.inits[0].ux_mode).toBe('popup');

    expect(gsi.renders[0].childrenBefore).toBe(0);
    expect(gsi.renders[0].options).toMatchObject({
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      locale: 'en',
    });
    const width = Number(gsi.renders[0].options['width']);
    expect(width).toBeGreaterThanOrEqual(200);
    expect(width).toBeLessThanOrEqual(400);

    // The fake button landed inside the Google block, above the "or" divider and the form.
    await expect(page.locator('.gsi-block .gsi-stub-button')).toHaveCount(1);
    await expect(page.locator('.gsi-block__or')).toBeVisible();
  });

  // Journey 3 (M-056 regression)
  test('POST /api/auth/external carries preferredLanguage = the UI language (hy) and no nonce or email field', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, { external: { me: e2eUser() } });

    await page.goto('/');
    await page.locator('.lang-selector__trigger').click();
    await page.locator('.lang-selector__row', { hasText: 'Հայերեն' }).click();
    // The header button is translated now; read its hy label from the translation file.
    const hy = JSON.parse(readFileSync('public/i18n/hy.json', 'utf-8').replace(/^﻿/, ''));
    await page.getByRole('button', { name: hy.app.shell.nav.login }).click();
    await expect(page.locator('.gsi-block')).toBeVisible();
    await expectRenders(page, 1);

    // The button is rendered in the UI language.
    expect((await gsiState(page)).renders[0].options['locale']).toBe('hy');

    const idToken = credential();
    await fireGoogleCredential(page, idToken);

    await expect.poll(() => callsTo(calls, 'POST', '/api/auth/external')).toHaveLength(1);
    const body = callsTo(calls, 'POST', '/api/auth/external')[0].body as Record<string, unknown>;
    expect(body).toEqual({ provider: 'google', idToken, preferredLanguage: 'hy' });
  });

  // Journey 2
  test('a Google account without a first name gets a mandatory, non-dismissable name step that saves trimmed values', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, { external: { me: e2eUser({ firstName: '', lastName: '' }) } });

    await openLogin(page);
    await expectRenders(page, 1);
    await fireGoogleCredential(page, credential());

    const step = page.locator('.dr-step-dialog--name');
    await expect(step).toBeVisible();
    await expect(step.locator('.p-dialog-close-button')).toHaveCount(0);

    // Cannot be dismissed: Esc and a click on the mask do nothing.
    await page.keyboard.press('Escape');
    await expect(step).toBeVisible();
    await page.locator('.p-dialog-mask').last().click({ position: { x: 4, y: 4 } });
    await expect(step).toBeVisible();

    // Empty Continue: the field error shows, nothing is sent.
    await step.locator('button[type="submit"]').click();
    await expect(step).toContainText('Enter your first name');
    expect(callsTo(calls, 'PUT', '/api/auth/me/name')).toHaveLength(0);

    const inputs = step.locator('input');
    await inputs.nth(0).fill('  Anna  ');
    await inputs.nth(1).fill('  Petrosyan ');
    await step.locator('button[type="submit"]').click();

    await expect(step).toBeHidden();
    await expect(page.getByText('Welcome to DoRent, Anna')).toBeVisible();
    const puts = callsTo(calls, 'PUT', '/api/auth/me/name');
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ firstName: 'Anna', lastName: 'Petrosyan' });
  });

  // Journey 4
  test('409 auth.external_link_conflict switches to Sign in, prefills the credential email and focuses the password', async ({
    page,
  }) => {
    await mockApi(page, {
      external: {
        status: 409,
        body: {
          type: 'urn:rental:error:auth.external_link_conflict',
          title: 'An account with this email exists',
          status: 409,
          errorCode: 'auth.external_link_conflict',
        },
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.locator('.gsi-block')).toBeVisible();
    await expectRenders(page, 1);
    await expect(page.locator('.auth-dialog__tab--active')).toHaveText('Create account');
    // p-dialog moves focus to its first focusable when its open animation
    // ends. A human needs seconds to finish a Google popup; the stub answers instantly, so wait
    // for that initial focus to land or it would steal focus back from the password field.
    await page.waitForFunction(() =>
      document.querySelector('.auth-dialog')?.contains(document.activeElement),
    );

    await fireGoogleCredential(page, credential());

    await expect(page.locator('.auth-dialog__tab--active')).toHaveText('Sign in');
    await expect(page.getByTestId('google-exists')).toContainText(
      'An account with this email already exists. Sign in with your password.',
    );
    const form = page.locator('form.auth-form');
    await expect(form.locator('input.uii-native').nth(0)).toHaveValue(CREDENTIAL_EMAIL);
    await expect(form.locator('input.uii-native').nth(1)).toBeFocused();
    // A conflict is not an error banner under the button.
    await expect(page.getByTestId('google-error')).toHaveCount(0);
  });

  // Journey 5
  test('503 auth.external_provider_unavailable removes the Google block and divider with a warning until the dialog is reopened', async ({
    page,
  }) => {
    await mockApi(page, {
      external: {
        status: 503,
        body: {
          type: 'urn:rental:error:auth.external_provider_unavailable',
          title: 'Unavailable',
          status: 503,
          errorCode: 'auth.external_provider_unavailable',
        },
      },
    });

    await openLogin(page);
    await expectRenders(page, 1);
    await fireGoogleCredential(page, credential());

    await expect(page.getByTestId('google-off')).toContainText(
      'Google sign-in is unavailable right now. Sign in with email and password.',
    );
    await expect(page.locator('.gsi-block')).toHaveCount(0);
    await expect(page.locator('.gsi-block__or')).toHaveCount(0);
    // The password form is still there.
    await expect(page.locator('form.auth-form')).toBeVisible();

    // Close and reopen: the block is back, the warning gone.
    await page.keyboard.press('Escape');
    await expect(page.locator('form.auth-form')).toBeHidden();
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.locator('.gsi-block')).toBeVisible();
    await expect(page.getByTestId('google-off')).toHaveCount(0);
  });

  // Register: the Google block belongs to step 1 only
  test('on Create account the Google block is on step 1 and absent on the home-point step', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {});

    await page.goto('/');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.locator('.auth-dialog__tab--active')).toHaveText('Create account');
    await expect(page.locator('.gsi-block')).toBeVisible();

    const inputs = page.locator('form.auth-form input.uii-native');
    await expect(inputs).toHaveCount(5);
    await inputs.nth(0).fill('Anna');
    await inputs.nth(1).fill('Petrosyan');
    await inputs.nth(2).fill('+37491234567');
    await inputs.nth(3).fill('anna.p@gmail.com');
    await inputs.nth(4).fill('supersecret');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(page.locator('app-home-point-map')).toBeVisible();
    await expect(page.locator('.gsi-block')).toHaveCount(0);
  });

  // Journey 10
  test('after every server answer a new nonce is fetched and the button is re-rendered (initialize + render pair)', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, {
      external: {
        status: 400,
        body: {
          type: 'urn:rental:error:auth.external_invalid_token',
          title: 'Invalid token',
          status: 400,
          errorCode: 'auth.external_invalid_token',
        },
      },
    });

    await openLogin(page);
    await expectRenders(page, 1);

    // First answer.
    await fireGoogleCredential(page, credential('e2e-nonce-1'));
    await expectRenders(page, 2);
    await expect(page.getByTestId('google-error')).toContainText(
      'Couldn’t sign in with Google. Please try again.',
    );
    expect(callsTo(calls, 'POST', '/api/auth/external/nonce')).toHaveLength(2);
    let gsi = await gsiState(page);
    expect(gsi.events).toEqual([
      'initialize:e2e-nonce-1',
      'render',
      'initialize:e2e-nonce-2',
      'render',
    ]);
    // The container was emptied before the second render (the stub left a child behind).
    expect(gsi.renders[1].childrenBefore).toBe(0);
    await expect(page.locator('.gsi-block .gsi-stub-button')).toHaveCount(1);

    // Second answer: the pair repeats with the NEXT nonce.
    await fireGoogleCredential(page, credential('e2e-nonce-2'));
    await expectRenders(page, 3);
    expect(callsTo(calls, 'POST', '/api/auth/external')).toHaveLength(2);
    expect(callsTo(calls, 'POST', '/api/auth/external/nonce')).toHaveLength(3);
    gsi = await gsiState(page);
    expect(gsi.events.slice(4)).toEqual(['initialize:e2e-nonce-3', 'render']);
    expect(gsi.renders[2].childrenBefore).toBe(0);
  });

  // Journey 11 (5f9a9f1: the GIS script is reloaded with hl=<code> on a language switch)
  test('switching the UI language with the dialog open reloads gsi/client with hl, re-initializes with the SAME nonce and re-renders', async ({
    page,
  }) => {
    const calls = recordCalls(page);
    await mockApi(page, { external: { me: e2eUser() } });

    await openLogin(page);
    await expectRenders(page, 1);

    for (const [row, code, total] of [
      ['Русский', 'ru', 2],
      ['Հայերեն', 'hy', 3],
    ] as const) {
      // The dialog's modal mask covers the header selector, so a pointer click would hit the
      // mask (and close the dialog). Dispatch the click straight to the same handlers instead.
      await page.locator('.lang-selector__trigger:visible').first().dispatchEvent('click');
      await page.locator('.lang-selector__row', { hasText: row }).dispatchEvent('click');
      await expectRenders(page, total);
      const loads = (await gsiState(page)).loads;
      expect(loads.at(-1)?.endsWith(`/gsi/client?hl=${code}`)).toBe(true);
    }

    const gsi = await gsiState(page);
    expect(gsi.loads.map((l) => new URL(l).searchParams.get('hl'))).toEqual(['en', 'ru', 'hy']);
    // Exactly one script tag survives the two reloads.
    await expect(page.locator('script[src*="accounts.google.com/gsi/client"]')).toHaveCount(1);

    // No new nonce was requested: every initialize carries the SAME one, each followed by a render
    // into an emptied container with the new locale.
    expect(callsTo(calls, 'POST', '/api/auth/external/nonce')).toHaveLength(1);
    expect(gsi.events).toEqual([
      'initialize:e2e-nonce-1',
      'render',
      'initialize:e2e-nonce-1',
      'render',
      'initialize:e2e-nonce-1',
      'render',
    ]);
    expect(gsi.renders.map((r) => r.childrenBefore)).toEqual([0, 0, 0]);
    expect(gsi.renders.map((r) => r.options['locale'])).toEqual(['en', 'ru', 'hy']);
    await expect(page.locator('.gsi-block .gsi-stub-button')).toHaveCount(1);

    // The re-created GIS still delivers credentials: one /external request, no more.
    await fireGoogleCredential(page, credential());
    await expect.poll(() => callsTo(calls, 'POST', '/api/auth/external')).toHaveLength(1);
  });
});
