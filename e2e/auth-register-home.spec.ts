import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';

/**
 * Critical journey (home-point model): sign-up is now TWO steps, and the home
 * point the second step collects travels in the `POST /api/auth/register` body
 * itself. The only screen after it is the "check your email" step (ADR-028:
 * register answers 201 with NO token), so if the coordinates do not make it
 * into that one request, they are lost with no second chance. That is the
 * single contract this journey checks — plus that registering signs nobody in.
 *
 * Both exits are covered, because they are different payloads, not different
 * copies of one: "Create account" sends `homeLatitude`/`homeLongitude`, and
 * "Skip" must send NEITHER (the backend rejects one without the other with a
 * field-level 400).
 */
test.describe('Sign-up — home point step', () => {
  async function fillStepOne(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: 'Log in' }).click();
    // The dialog opens on Login; switch to the Create-account tab.
    await page.getByRole('tab', { name: 'Create account' }).click();

    const form = page.locator('form.auth-form');
    const inputs = form.locator('input.uii-native');
    // Wait for the REGISTER form to have replaced the login one before
    // addressing fields by index: the dialog swaps `app-login-form` for
    // `app-register-form`, login has two `input.uii-native` and register has
    // five, so a fill issued too early writes "Anna" into the login email box
    // and is thrown away with that form — leaving step 1 invalid for reasons
    // nothing in the failure message mentions.
    await expect(inputs).toHaveCount(5);
    await inputs.nth(0).fill('Anna');
    await inputs.nth(1).fill('Petrosyan');
    await inputs.nth(2).fill('+37491234567');
    await inputs.nth(3).fill('anna.p@gmail.com');
    await inputs.nth(4).fill('supersecret');
  }

  test('creates the account WITH the chosen home point in the register body', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page);

    await fillStepOne(page);

    // "Continue" must NOT create the account — that is what lets a rejected
    // email come back to step 1 with everything still filled in.
    const registerRequests: unknown[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/register') && req.method() === 'POST') {
        registerRequests.push(req.postDataJSON());
      }
    });

    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('app-home-point-map')).toBeVisible();
    expect(registerRequests).toHaveLength(0);

    // The map opens on the city centre and "Create account" stays disabled
    // until the point is chosen on purpose — nobody registers Republic Square
    // by accident.
    const createButton = page.getByRole('button', { name: 'Create account', exact: true });
    await expect(createButton).toBeDisabled();

    // A deliberate pan: drag the map so the crosshair lands somewhere the
    // owner actually chose.
    const map = page.locator('app-home-point-map .app-map__surface');
    // `leaflet-container` is the class Leaflet adds once it owns the element.
    await expect(map).toHaveClass(/leaflet-container/);
    const box = await map.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 - 60, box!.y + box!.height / 2 - 40, {
      steps: 10,
    });
    await page.mouse.up();

    await expect(createButton).toBeEnabled();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/register') && req.method() === 'POST',
      ),
      createButton.click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body['email']).toBe('anna.p@gmail.com');
    // The verification email is sent in this language (default UI language: English).
    expect(body['preferredLanguage']).toBe('en');
    // The whole point of the journey: the coordinates travel with the account.
    expect(typeof body['homeLatitude']).toBe('number');
    expect(typeof body['homeLongitude']).toBe('number');
    // Yerevan-ish, i.e. a real coordinate read off the map rather than a
    // leftover default of 0/0 or undefined.
    expect(Number(body['homeLatitude'])).toBeGreaterThan(39);
    expect(Number(body['homeLatitude'])).toBeLessThan(42);
    expect(Number(body['homeLongitude'])).toBeGreaterThan(43);
    expect(Number(body['homeLongitude'])).toBeLessThan(46);

    // ADR-028: the account is created but NOT signed in — the dialog swaps the
    // form for the "check your email" step, naming the address.
    const checkEmail = page.getByTestId('check-email-step');
    await expect(checkEmail).toBeVisible();
    await expect(checkEmail).toContainText('anna.p@gmail.com');
    await expect(page.locator('form.auth-form')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('auth_token'))).toBeNull();
  });

  test('"Skip for now" creates the account with NEITHER coordinate', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page);

    await fillStepOne(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('app-home-point-map')).toBeVisible();

    // Skip is enabled from the start — renting needs no home point, so this
    // step must never be a dead end.
    const skip = page.getByRole('button', { name: /Skip for now/ });
    await expect(skip).toBeEnabled();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/register') && req.method() === 'POST',
      ),
      skip.click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(body['email']).toBe('anna.p@gmail.com');
    // BOTH-OR-NEITHER: sending one of the two is a 400 from the backend, so a
    // skip that leaked a half-pair would break sign-up outright.
    expect(body).not.toHaveProperty('homeLatitude');
    expect(body).not.toHaveProperty('homeLongitude');

    await expect(page.getByTestId('check-email-step')).toBeVisible();
    await expect(page.locator('form.auth-form')).toBeHidden();
  });

  test('a duplicate email comes back to step 1 with the field in error and the rest kept', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {
      register: {
        status: 409,
        body: {
          type: 'urn:rental:error:auth.duplicate_email',
          title: 'Email already registered',
          status: 409,
          errorCode: 'auth.duplicate_email',
        },
      },
    });

    await fillStepOne(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('app-home-point-map')).toBeVisible();

    await page.getByRole('button', { name: /Skip for now/ }).click();

    // Back on step 1, with the email flagged...
    await expect(page.locator('app-home-point-map')).toBeHidden();
    await expect(page.getByText('This email is already registered.')).toBeVisible();
    // ...and nothing else thrown away.
    const inputs = page.locator('form.auth-form input.uii-native');
    await expect(inputs.nth(0)).toHaveValue('Anna');
    await expect(inputs.nth(3)).toHaveValue('anna.p@gmail.com');
  });

  test('a 429 cooldown on register shows a neutral try-later message and stays on the form', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, {
      register: {
        status: 429,
        body: {
          type: 'urn:rental:error:auth.verification_cooldown',
          title: 'Please wait before requesting another email',
          status: 429,
          errorCode: 'auth.verification_cooldown',
        },
      },
    });

    await fillStepOne(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /Skip for now/ }).click();

    await expect(page.getByText('Too many confirmation emails for this address. Please try again later.')).toBeVisible();
    await expect(page.getByTestId('check-email-step')).toBeHidden();
  });

  test('a 503 on register says registration is temporarily unavailable', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, {
      register: {
        status: 503,
        body: {
          type: 'urn:rental:error:auth.registration_unavailable',
          title: 'Registration unavailable',
          status: 503,
          errorCode: 'auth.registration_unavailable',
        },
      },
    });

    await fillStepOne(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /Skip for now/ }).click();

    await expect(page.getByText('Registration is temporarily unavailable.')).toBeVisible();
  });

  test('the check-your-email step has a resend button locked by a 60 s countdown', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page);

    await fillStepOne(page);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: /Skip for now/ }).click();

    const step = page.getByTestId('check-email-step');
    await expect(step).toBeVisible();
    // Sent a moment ago, so the button starts locked with the countdown shown.
    await expect(step.getByRole('button', { name: /Resend in \d+s/ })).toBeDisabled();
  });
});
