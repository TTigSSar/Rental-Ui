import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import { mockTiles } from './support/tile-mock';
import { e2eHomePoint, e2eUser } from './support/fixtures';

/**
 * Critical journey (home-point model): moving the home point from the profile
 * card. Saving it relocates EVERY listing the owner has, server-side — which is
 * why the card insists on a confirmation naming how many toys move, and why the
 * one thing worth pinning end-to-end is that the PUT carries the coordinates
 * the owner actually chose (and that Cancel sends nothing at all).
 */
const KENTRON = {
  id: 'd1111111-1111-1111-1111-111111111111',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

function ownerWithPoint() {
  return e2eUser({ homePoint: e2eHomePoint({ district: KENTRON }) });
}

/** Two listings so the "moves N toys" branch is the one under test. */
function twoListings() {
  return [
    { id: 'l-1', title: 'Wooden Train', status: 'Approved', pricePerDay: 1500 },
    { id: 'l-2', title: 'Balance Bike', status: 'Approved', pricePerDay: 2000 },
  ];
}

async function openProfile(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'e2e-jwt-token');
  });
  await page.goto('/profile');
  await expect(page.locator('app-home-point-card')).toBeVisible();
}

/** Drags the picker's map so the crosshair sits somewhere deliberately chosen. */
async function panPicker(page: import('@playwright/test').Page): Promise<void> {
  const surface = page.locator('.location-picker-dialog app-home-point-map .app-map__surface');
  await expect(surface).toBeVisible();
  // `leaflet-container` is the class Leaflet adds once it owns the element.
  // Before that, mouse events land on a plain div and pan nothing.
  await expect(surface).toHaveClass(/leaflet-container/);
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  // Horizontal only, from the vertical middle: a purely sideways drag cannot
  // wander outside the element's own box the way a diagonal one can, and it
  // moves the LONGITUDE, which is what the assertion then reads.
  const y = box!.y + box!.height / 2;
  const x = box!.x + box!.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 5 });
  await page.mouse.move(x - 140, y, { steps: 10 });
  await page.mouse.up();

  // Wait for the component to have SEEN the pan, then for its district lookup
  // to settle. Leaflet fires `moveend` after its own inertia, so a Confirm
  // issued the instant the mouse is released can still read the pre-pan centre
  // — which is a test-timing artefact (a real click arrives far later), but one
  // that makes this journey assert the opposite of what it means to.
  const chip = page.locator('.location-picker-dialog .hp-map__chip');
  await expect(chip).toHaveClass(/hp-map__chip--neutral/);
  await expect(chip).not.toHaveClass(/hp-map__chip--neutral/);
}

test.describe('Profile — home point', () => {
  test('Change → picker → confirmation → PUT carries the new coordinates', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: twoListings() });

    await openProfile(page);

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await panPicker(page);

    const confirm = page.getByRole('button', { name: 'Confirm', exact: true });
    await expect(confirm).toBeEnabled();

    // Confirming the picker must NOT save yet — the "this moves N toys"
    // confirmation is the gate, and it has to come first.
    const puts: unknown[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/me/home-point') && req.method() === 'PUT') {
        puts.push(req.postDataJSON());
      }
    });

    await confirm.click();
    await expect(page.locator('.hp-sheet__body')).toBeVisible();
    expect(puts).toHaveLength(0);

    // The confirmation names both ends of the move and the toy count.
    await expect(page.locator('.hp-sheet__move')).toContainText('Kentron');
    await expect(page.locator('.hp-sheet__note')).toContainText('2');

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/me/home-point') && req.method() === 'PUT',
      ),
      page.getByRole('button', { name: 'Move home point', exact: true }).click(),
    ]);

    const body = request.postDataJSON() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['latitude', 'longitude']);
    expect(typeof body['latitude']).toBe('number');
    expect(typeof body['longitude']).toBe('number');
    // A real coordinate read off the panned map, not the saved point echoed
    // back and not a 0/0 default.
    expect(Number(body['latitude'])).toBeGreaterThan(39);
    expect(Number(body['latitude'])).toBeLessThan(42);
    expect(Number(body['longitude'])).toBeGreaterThan(43);
    expect(Number(body['longitude'])).toBeLessThan(46);
    // Proof the drag actually panned the real Leaflet map rather than being
    // swallowed by an overlay: the longitude cannot still be the saved point's.
    // (`openedOnExistingPoint` makes Confirm enabled from the start here, so
    // "the button became enabled" is NOT evidence of a pan in this flow.)
    expect(Number(body['longitude'])).not.toBe(e2eHomePoint().longitude);

    // The sheet closes and the success toast reports the completed move.
    await expect(page.locator('.hp-sheet__body')).toBeHidden();
    await expect(page.getByText('Home point updated')).toBeVisible();
  });

  test('Cancel on the confirmation keeps the old point and sends nothing', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: twoListings() });

    await openProfile(page);

    const puts: unknown[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/me/home-point')) puts.push(req.method());
    });

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await panPicker(page);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.locator('.hp-sheet__body')).toBeVisible();

    await page.locator('.hp-sheet__secondary').click();

    await expect(page.locator('.hp-sheet__body')).toBeHidden();
    expect(puts).toHaveLength(0);
    // The card still shows the original district.
    await expect(page.locator('app-home-point-card')).toContainText('Kentron');
  });

  /**
   * Removing a point while listings exist leaves them unplaceable, so the
   * backend refuses with 409 `auth.home_point_in_use`. The card must not let
   * the owner get that far.
   */
  test('Remove is blocked while the owner still has toys, and offered once they do not', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: twoListings() });
    await openProfile(page);

    await expect(page.locator('.hp-card__remove-btn')).toBeDisabled();
    await expect(page.locator('.hp-card__remove-note')).toBeVisible();
  });

  test('with no toys, Remove confirms and DELETEs', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: [] });
    await openProfile(page);

    const removeButton = page.locator('.hp-card__remove-btn');
    await expect(removeButton).toBeEnabled();
    await removeButton.click();

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/auth/me/home-point') && req.method() === 'DELETE',
      ),
      page.locator('.hp-remove__confirm').click(),
    ]);

    expect(request.method()).toBe('DELETE');
  });

  /**
   * Tigran's decision, superseding the boards: a point outside Yerevan is
   * refused for everyone, and the refusal arrives in `errorCode` — not as a
   * field-level validation message — so the UI has to read it with
   * `getApiErrorCode()` or it has no way to tell this 400 from any other.
   */
  test('a server refusal for a point outside Yerevan surfaces on the card', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, {
      me: ownerWithPoint(),
      myListings: twoListings(),
      updateHomePoint: {
        status: 400,
        body: {
          type: 'urn:rental:error:auth.home_point_outside_yerevan',
          title: 'Home point must be inside Yerevan',
          status: 400,
          errorCode: 'auth.home_point_outside_yerevan',
        },
      },
    });

    await openProfile(page);
    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await panPicker(page);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByRole('button', { name: 'Move home point', exact: true }).click();

    await expect(page.locator('.hp-card__error')).toBeVisible();
    await expect(page.locator('.hp-card__error')).toContainText('Yerevan');
    // No success toast for a refused save.
    await expect(page.getByText('Home point updated')).toBeHidden();
  });
});

/**
 * `GET /api/districts/at` is anonymous and rate-limited per IP (60/min), and it
 * is called on every pan — so a 429 is a realistic, non-exceptional outcome.
 * It must degrade to "we could not name the district", never to a frozen
 * picker: a failed lookup is NOT evidence the point is outside Yerevan, and
 * treating it as such would disable Confirm on a network blip and tell the
 * owner their home is in the wrong city.
 */
test('a rate-limited district lookup leaves the picker usable', async ({ page }) => {
  await mockTiles(page);
  await mockApi(page, {
    me: ownerWithPoint(),
    myListings: twoListings(),
    districtAtStatus: 429,
  });

  await openProfile(page);
  await page.getByRole('button', { name: 'Change', exact: true }).click();

  const chip = page.locator('.location-picker-dialog .hp-map__chip');
  // The chip settles out of its "checking…" state instead of spinning forever.
  await expect(chip).not.toHaveClass(/hp-map__chip--neutral/);
  // Not an error either — nothing was refused.
  await expect(chip).not.toHaveClass(/hp-map__chip--error/);
  // And the point stays confirmable (the picker opened on the saved one).
  await expect(page.getByRole('button', { name: 'Confirm', exact: true })).toBeEnabled();
});

/**
 * F1 regression, in the only tier that can see it. Both confirmations set
 * `[closable]="false"` (the one way to suppress PrimeNG's default header close
 * icon on this custom sheet chrome), and PrimeNG's `enableModality()` binds its
 * mask-click listener only `if (this.closable && this.dismissableMask)` — so
 * the backdrop dismissed neither dialog, and `(visibleChange)` never fired.
 *
 * The earlier fix added a `window:keydown` handler and the comment around it
 * described the backdrop as handled too; only Escape was ever tested, so 1601
 * unit tests and 99 e2e specs stayed green over a false claim. jsdom cannot
 * adjudicate a pointer gesture against a portalled overlay (M-029's own
 * detection note), so these run a real mouse at a real coordinate in a real
 * browser: the click lands at (8, 8), which is the top-left corner of the mask
 * on every viewport, well clear of a bottom sheet and of a centred dialog.
 */
test.describe('Profile — home point: a backdrop click dismisses the confirmations', () => {
  test('clicking the backdrop cancels the change confirmation and saves nothing', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: twoListings() });
    await openProfile(page);

    const writes: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/me/home-point')) writes.push(req.method());
    });

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await panPicker(page);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.locator('.hp-sheet__body')).toBeVisible();

    await page.mouse.click(8, 8);

    await expect(page.locator('.hp-sheet__body')).toBeHidden();
    // A backdrop click DECLINES — the same contract Cancel and Escape have.
    expect(writes).toHaveLength(0);
    await expect(page.locator('app-home-point-card')).toContainText('Kentron');
  });

  test('clicking the backdrop cancels the remove confirmation and DELETEs nothing', async ({
    page,
  }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: [] });
    await openProfile(page);

    const writes: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/auth/me/home-point')) writes.push(req.method());
    });

    await page.locator('.hp-card__remove-btn').click();
    await expect(page.locator('.hp-remove__body')).toBeVisible();

    await page.mouse.click(8, 8);

    await expect(page.locator('.hp-remove__body')).toBeHidden();
    expect(writes).toHaveLength(0);
  });

  /**
   * A click that starts INSIDE the sheet must not dismiss it — otherwise
   * selecting the sheet's text would decline the confirmation. This is the half
   * of the fix that an over-broad `closest()` check would break, and it would
   * break silently: the dialog would still "dismiss on a backdrop click".
   */
  test('a click inside the sheet leaves it open', async ({ page }) => {
    await mockTiles(page);
    await mockApi(page, { me: ownerWithPoint(), myListings: twoListings() });
    await openProfile(page);

    await page.getByRole('button', { name: 'Change', exact: true }).click();
    await panPicker(page);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.locator('.hp-sheet__body')).toBeVisible();

    await page.locator('.hp-sheet__title').click();

    await expect(page.locator('.hp-sheet__body')).toBeVisible();
  });
});

/**
 * F2 regression. A refused Remove used to render Angular's internal
 * `HttpErrorResponse.message` — "Http failure response for
 * https://localhost:7241/api/auth/me/home-point: 409 Conflict" — inside
 * `.hp-card__error[role="alert"]`, API host and all. `auth.home_point_in_use`
 * had no user-facing copy on this path, and neither did anything else except
 * `auth.home_point_outside_yerevan`.
 *
 * The 409 body here is the one the REAL backend sends
 * (`ServiceError.ToProblemDetails` — `errorCode` extension member plus an
 * English `title`), so this also pins that the server's own English title does
 * not reach the card.
 */
test('a refused Remove shows real copy, not Angular’s error string', async ({ page }) => {
  await mockTiles(page);
  await mockApi(page, {
    me: ownerWithPoint(),
    myListings: [],
    clearHomePoint: {
      status: 409,
      body: {
        type: 'urn:rental:error:auth.home_point_in_use',
        title: 'Home point is in use by your listings.',
        status: 409,
        errorCode: 'auth.home_point_in_use',
      },
    },
  });
  await openProfile(page);

  await page.locator('.hp-card__remove-btn').click();
  await page.locator('.hp-remove__confirm').click();

  const error = page.locator('.hp-card__error[role="alert"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText('toys listed');
  await expect(error).not.toContainText('Http failure');
  await expect(error).not.toContainText('localhost:7241');
  await expect(error).not.toContainText('in use by your listings');
  // And no success toast for a removal that did not happen.
  await expect(page.getByText('Home point removed')).toBeHidden();
});

/**
 * The home-point routes are rate-limited (`RateLimiterExtensions.HomePointPolicy`),
 * and a 429 arrives with NO ProblemDetails body at all — so `errorCode` is null
 * and `toApiErrorMessage()` falls all the way through to
 * `HttpErrorResponse.message`. That is the path with nothing to map, and the
 * one that leaked the API URL most readily.
 */
test('an unmapped refusal still shows copy rather than the raw message', async ({ page }) => {
  await mockTiles(page);
  await mockApi(page, {
    me: ownerWithPoint(),
    myListings: [],
    clearHomePoint: { status: 429, body: {} },
  });
  await openProfile(page);

  await page.locator('.hp-card__remove-btn').click();
  await page.locator('.hp-remove__confirm').click();

  const error = page.locator('.hp-card__error[role="alert"]');
  await expect(error).toBeVisible();
  await expect(error).not.toContainText('Http failure');
  await expect(error).not.toContainText('localhost:7241');
  await expect(error).toContainText('home point');
});
