import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  ACCOUNTS,
  API_URL,
  TOY_KITCHEN,
  apiLogin,
  apiRegister,
  assertDockerStack,
  assertLoginNotRateLimited,
  awaitRateWindow,
  loginViaDialog,
  noteAuthSpend,
  type RegistrationDetails,
} from '../support/real-stack';

/**
 * Account deletion (ADR-056), end to end on the real stack.
 *
 * Why real-stack: the guarantee spans layers every cheaper tier fakes. The erasure is one SQL
 * Server transaction (backend tests run it on SQLite or a hand-built DB), the "old session is
 * dead" half is the ADR-055 TokenVersion check in the real JWT pipeline, and "the counterparty
 * sees Deleted user" is the real DTO flags (`counterpartyIsDeleted`, `counterpartIsDeleted`,
 * `reviewerIsDeleted`) rendered by the real Angular bundle.
 *
 * Data discipline (AD-2 qa note): this spec NEVER deletes a seeded demo account — the `sqldata`
 * volume persists and the seed never restores a deleted user. Every deleted account is a
 * disposable `qa-del-<runId>@rental.local` registered by this spec. `owner@` is only the
 * counterparty. D's booking ends Completed and B's is cancelled, so neither leaves a blocking
 * booking behind (a crashed run might; `bookFreeWindow` searches around such leftovers).
 *
 * Auth budget (`auth` policy, 5/min per IP; `DELETE /api/auth/me` carries it too): this spec
 * spends 3 `direct` (register D, register B, the old-credentials login) and 2 `proxied` (the two
 * deletes from the UI), plus at most 1 `proxied` for the owner's dialog login on a cold cache.
 * `verify-email` has its own policy. The up-front `awaitRateWindow` fits that into the current
 * window of this worker, but it can only see spend made EARLIER in the same run - which is why
 * this file is named `user-...`: it sorts after every other real spec (workers: 1, alphabetical),
 * so it waits for the window to clear instead of starving the specs after it (the whole
 * suite already uses 5 of 5 in each bucket, e2e/README.md).
 */

const runId = Date.now().toString(36);

function disposableUser(label: string): RegistrationDetails {
  return {
    firstName: 'QaDel',
    lastName: `Zq${label}${runId}`,
    phone: '+37491234570',
    email: `qa-del-${label.toLowerCase()}-${runId}@rental.local`,
    password: 'Demo1234',
  };
}

function isoInMonths(monthsAhead: number, day: number): string {
  const d = new Date();
  const y = d.getUTCFullYear() + Math.floor((d.getUTCMonth() + monthsAhead) / 12);
  const m = ((d.getUTCMonth() + monthsAhead) % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function post<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data?: unknown,
  expectedStatus?: number,
): Promise<T> {
  const res = await request.post(`${API_URL}${path}`, {
    headers: bearer(token),
    data,
    failOnStatusCode: false,
  });
  if (expectedStatus ? res.status() !== expectedStatus : !res.ok()) {
    throw new Error(`POST ${path} failed: ${res.status()} ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Opens Settings and the delete dialog, types the password. Does not submit. */
async function openDeleteDialogWithPassword(page: Page, password: string): Promise<void> {
  await page.goto('/profile/settings');
  await page.getByTestId('delete-account-row').click();
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeVisible();
  await page.locator('.dad__field input.uii-native').fill(password);
}

test.describe('Account deletion journey (ADR-056, real stack)', () => {
  test('the public /account-deletion page opens while signed out, without a login redirect', async ({
    page,
    request,
  }) => {
    await assertDockerStack(request);
    await page.goto('/account-deletion');
    await expect(page).toHaveURL(/\/account-deletion$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Delete your DoRent account' })).toBeVisible();
    await expect(page.getByTestId('account-deletion-cta')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    // Signed out and still on the page: the auth dialog is not forced open.
    await expect(page.locator('form.auth-form')).toHaveCount(0);
  });

  test('open rental blocks deletion; deleting a user erases the session and shows "Deleted user" to the counterparty', async ({
    page,
    request,
  }) => {
    const blockedUser = disposableUser('B');
    const deletedUser = disposableUser('D');
    const reviewComment = `qa-del review ${runId}`;
    const chatText = `qa-del hello ${runId}`;
    const createdBookingsToCancel: { id: string; token: string }[] = [];

    // Stated reason: in a full run this file sorts last, after the rest of the suite has used
    // both auth buckets, so `awaitRateWindow` below legitimately waits for up to one fixed
    // 60s window (+2s margin). That wait counts against the test timeout (180s project default
    // is too tight with the ~25s journey after it).
    test.setTimeout(300_000);

    await assertDockerStack(request);
    await Promise.all([
      awaitRateWindow('auth', 'direct', 3),
      awaitRateWindow('auth', 'proxied', 3),
    ]);

    const blockedJwt = await apiRegister(request, blockedUser);
    const deletedJwt = await apiRegister(request, deletedUser);
    const ownerJwt = await apiLogin(request, ACCOUNTS.owner);

    try {
      // ---- API setup: D has a Completed rental with a chat message and a review; B an Approved one.
      const approve = (id: string) => post(request, ownerJwt, `/api/bookings/${id}/approve`);
      /**
       * Books the first free 2-day window, scanning a fixed grid of candidate days. A crashed
       * earlier run can leave an Approved booking of its disposable user on this shared listing
       * (nobody can cancel it any more), which makes a fixed window answer 409 booking.overlap -
       * so the window is searched, never assumed. Only that one error moves on to the next day.
       */
      const bookFreeWindow = async (token: string, months: readonly number[]) => {
        for (const month of months) {
          for (let day = 1 + (Date.now() % 4); day <= 26; day += 4) {
            const res = await request.post(`${API_URL}/api/bookings`, {
              headers: bearer(token),
              data: {
                listingId: TOY_KITCHEN.id,
                startDate: isoInMonths(month, day),
                endDate: isoInMonths(month, day + 2),
              },
              failOnStatusCode: false,
            });
            if (res.ok()) return (await res.json()) as { id: string };
            const body = (await res.json().catch(() => ({}))) as { errorCode?: string };
            if (body.errorCode !== 'booking.overlap') {
              throw new Error(`POST /api/bookings failed: ${res.status()} ${JSON.stringify(body)}`);
            }
          }
        }
        throw new Error('no free booking window found on the grid');
      };

      const dBooking = await bookFreeWindow(deletedJwt, [3, 6, 9]);
      await approve(dBooking.id);
      const conversation = await post<{ id: string }>(
        request,
        deletedJwt,
        `/api/chat/conversations/from-booking/${dBooking.id}`,
      );
      await post(request, deletedJwt, '/api/chat/messages', {
        conversationId: conversation.id,
        content: chatText,
      });
      await post(request, ownerJwt, `/api/bookings/${dBooking.id}/activate`);
      await post(request, ownerJwt, `/api/bookings/${dBooking.id}/complete`);
      await post(
        request,
        deletedJwt,
        '/api/reviews/toy',
        {
          bookingId: dBooking.id,
          overallRating: 4,
          conditionRating: 4,
          cleanlinessRating: 4,
          valueForMoneyRating: 4,
          funPlayValueRating: 4,
          descriptionAccuracyRating: 4,
          comment: reviewComment,
        },
        201,
      );

      const bBooking = await bookFreeWindow(blockedJwt, [4, 7, 10]);
      createdBookingsToCancel.push({ id: bBooking.id, token: blockedJwt });
      await approve(bBooking.id);

      // ---- 4. Approved rental blocks deletion: blocked state with the list, account remains.
      await test.step('a user with an Approved rental is blocked: dialog lists the open rental, account remains', async () => {
        await loginViaDialog(page, blockedUser);
        await openDeleteDialogWithPassword(page, blockedUser.password);
        noteAuthSpend('proxied', `DELETE /api/auth/me (blocked) ${blockedUser.email}`);
        const [res] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().endsWith('/api/auth/me') && r.request().method() === 'DELETE',
          ),
          page.getByTestId('dad-confirm').click(),
        ]);
        assertLoginNotRateLimited(res.status(), blockedUser.email);
        expect(res.status()).toBe(409);
        const body = (await res.json()) as {
          errorCode?: string;
          openRentals?: { bookingId: string; role: string }[];
        };
        expect(body.errorCode).toBe('account.has_open_rentals');
        expect(body.openRentals).toEqual([
          expect.objectContaining({ bookingId: bBooking.id, role: 'renter' }),
        ]);

        await expect(page.getByRole('heading', { name: 'You can’t delete your account yet' })).toBeVisible();
        const rows = page.getByTestId('dad-rental');
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText(TOY_KITCHEN.title);
        await expect(rows.first()).toContainText('You’re renting');
        await expect(rows.first()).toHaveAttribute('href', `/bookings/${bBooking.id}`);
        await expect(page.getByTestId('dad-cta')).toContainText('Go to my rentals');

        // Nothing changed: the same session still authenticates as the same account.
        const me = await request.get(`${API_URL}/api/auth/me`, { headers: bearer(blockedJwt) });
        expect(me.status()).toBe(200);
        expect(((await me.json()) as { email: string }).email).toBe(blockedUser.email);
      });

      // ---- 1. Delete D through the UI.
      await test.step('a password user deletes the account through Settings and is signed out', async () => {
        await loginViaDialog(page, deletedUser);
        await openDeleteDialogWithPassword(page, deletedUser.password);
        noteAuthSpend('proxied', `DELETE /api/auth/me ${deletedUser.email}`);
        const [res] = await Promise.all([
          page.waitForResponse(
            (r) => r.url().endsWith('/api/auth/me') && r.request().method() === 'DELETE',
          ),
          page.getByTestId('dad-confirm').click(),
        ]);
        assertLoginNotRateLimited(res.status(), deletedUser.email);
        expect(res.status()).toBe(204);

        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByText('Your account has been deleted')).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
        await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
      });

      // ---- 2. The old session and the old credentials are dead.
      await test.step('the old token gets 401 and the old credentials are refused', async () => {
        const me = await request.get(`${API_URL}/api/auth/me`, {
          headers: bearer(deletedJwt),
          failOnStatusCode: false,
        });
        expect(me.status()).toBe(401);

        noteAuthSpend('direct', `login with deleted credentials ${deletedUser.email}`);
        const login = await request.post(`${API_URL}/api/auth/login`, {
          data: { email: deletedUser.email, password: deletedUser.password },
          failOnStatusCode: false,
        });
        assertLoginNotRateLimited(login.status(), deletedUser.email);
        expect(login.status()).toBe(401);
        const body = (await login.json()) as { accessToken?: string; token?: string };
        expect(body.accessToken ?? body.token).toBeUndefined();
      });

      // ---- 3. The counterparty (owner) sees "Deleted user" everywhere D appeared.
      await test.step('the owner sees "Deleted user" on the booking', async () => {
        await loginViaDialog(page, ACCOUNTS.owner);
        const detail = await request.get(`${API_URL}/api/bookings/${dBooking.id}`, {
          headers: bearer(ownerJwt),
        });
        const d = (await detail.json()) as {
          counterpartyIsDeleted: boolean;
          counterpartyFirstName: string;
          counterpartyLastName: string;
          status: string;
        };
        expect(d.counterpartyIsDeleted).toBe(true);
        expect(`${d.counterpartyFirstName}${d.counterpartyLastName}`).toBe('');
        expect(d.status).toBe('Completed');

        await page.goto(`/bookings/${dBooking.id}`);
        const counterparty = page.locator('.booking-details__counterparty--deleted');
        await expect(counterparty).toContainText('Deleted user');
        await expect(page.locator('.booking-details__counterparty--deleted a')).toHaveCount(0);
        await expect(page.getByText(deletedUser.lastName)).toHaveCount(0);
      });

      await test.step('the owner sees "Deleted user" in the chat, history readable, composer absent', async () => {
        await page.goto(`/chat/${conversation.id}`);
        await expect(page.getByText(chatText)).toBeVisible();
        await expect(page.locator('app-deleted-user-name').first()).toHaveText('Deleted user');
        await expect(page.getByText(deletedUser.lastName)).toHaveCount(0);
        await expect(page.locator('form.chat-thread__composer')).toHaveCount(0);
        // A Completed booking closes the chat first (ChatService.IsClosed), so the read-only footer
        // is the "rental finished" one; the "counterpart deleted" footer needs a still-open chat.
        await expect(page.locator('.chat-thread__closed')).toContainText('This rental is finished');

        // The API agrees: the conversation is read-only for the owner.
        const send = await request.post(`${API_URL}/api/chat/messages`, {
          headers: bearer(ownerJwt),
          data: { conversationId: conversation.id, content: 'anyone there?' },
          failOnStatusCode: false,
        });
        expect(send.status(), await send.text()).toBeGreaterThanOrEqual(400);
        expect(send.status()).toBeLessThan(500);
      });

      await test.step('the review D wrote stays public as "Deleted user"', async () => {
        const reviewsRes = await request.get(`${API_URL}/api/reviews/listing/${TOY_KITCHEN.id}`);
        const summary = (await reviewsRes.json()) as {
          comments: {
            comment: string;
            reviewerIsDeleted: boolean;
            reviewerFirstName: string;
            reviewerLastName: string;
          }[];
        };
        const mine = summary.comments.find((c) => c.comment === reviewComment);
        expect(mine, 'the deleted user’s review must still be listed').toBeDefined();
        expect(mine!.reviewerIsDeleted).toBe(true);
        expect(`${mine!.reviewerFirstName}${mine!.reviewerLastName}`).toBe('');

        await page.goto(`/listings/${TOY_KITCHEN.id}`);
        const card = page.locator('app-review-card', { hasText: reviewComment });
        // Reviews render asynchronously: wait for the list before deciding whether the card is
        // inside the 3-card preview (a bare isVisible() on a still-empty list reads "not there").
        await expect(page.locator('app-review-card').first()).toBeVisible();
        if (!(await card.isVisible())) {
          await page.locator('.detail-page__reviews-seeall').click({ timeout: 10_000 });
        }
        await expect(card).toBeVisible();
        await expect(card.locator('app-deleted-user-name')).toHaveText('Deleted user');
        await expect(card).not.toContainText(deletedUser.lastName);
      });
    } finally {
      // B's Approved booking would otherwise linger (and B can never be deleted while it exists).
      for (const b of createdBookingsToCancel) {
        await request.post(`${API_URL}/api/bookings/${b.id}/cancel`, {
          headers: bearer(b.token),
          failOnStatusCode: false,
        });
      }
    }
  });
});
