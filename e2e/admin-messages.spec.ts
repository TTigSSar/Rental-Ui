import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eAdmin,
  e2eAdminMessageThread,
  e2eChatMessage,
  e2eModerationConversationDetails,
  e2eModerationNoteMessage,
} from './support/fixtures';

/**
 * Critical journey: an admin holds a direct, booking-less "moderation" conversation with a
 * member at `/admin/messages` (`MessagesPageComponent`). Backend stays stubbed at the network
 * layer — see `support/api-mock.ts`'s `adminMessageThreads` (the thread queue) and
 * `chatConversationDetailsById` (thread detail, reused unchanged from `ChatApiService` — the
 * admin Messages screen deliberately does NOT duplicate the chat detail/send/read endpoints).
 *
 * The "Needs reply" filter test below is a regression test for a confirmed HIGH-severity bug:
 * `GET /api/admin/messages/threads?filter=unread` once silently ignored the `filter` query param
 * and returned every thread while the pill badge still showed the correct (filter-independent)
 * count — invisible to 579/579 backend tests and 62/62 e2e because nothing exercised this screen
 * at all. See `e2e/support/api-mock.ts`'s admin-messages GET handler doc comment: `items` is
 * filtered by the pill, `counts` is computed from the search-scoped set only, matching the real
 * contract's (formerly broken) pairing.
 */
test.describe('Admin messages', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('a moderator opens a thread, sees a moderation note render as a note card (not a bubble), and sends a reply', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eAdmin(),
      adminMessageThreads: [
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-1',
          memberFirstName: 'Renata',
          memberLastName: 'Renter',
          lastMessageType: 'moderationNote',
          lastMessageNoteSubject: 'Listing photos flagged',
          lastMessageSnippet: 'Photos did not match the listing description.',
        }),
      ],
      chatConversationDetailsById: {
        'admin-thread-e2e-1': e2eModerationConversationDetails({
          id: 'admin-thread-e2e-1',
          counterpartId: 'member-e2e-1',
          counterpartName: 'Renata Renter',
          messages: [
            e2eModerationNoteMessage({
              id: 'note-1',
              conversationId: 'admin-thread-e2e-1',
            }),
            e2eChatMessage({
              id: 'chat-message-e2e-1',
              conversationId: 'admin-thread-e2e-1',
              senderId: 'member-e2e-1',
              senderName: 'Renata Renter',
              body: 'Why was my listing rejected?',
              isMine: false,
            }),
          ],
        }),
      },
    });

    await page.goto('/admin/messages');
    await expect(page.getByText('Renata Renter')).toBeVisible();

    await page.locator('.messages-page__row-main').filter({ hasText: 'Renata Renter' }).click();

    await expect(page.locator('.messages-page__chat-header-name')).toContainText('Renata Renter');

    // The moderationNote message renders as the distinct card, not a plain chat bubble.
    const noteCard = page.locator('.mod-note');
    await expect(noteCard).toBeVisible();
    await expect(noteCard.locator('.mod-note__subject')).toContainText('Listing photos flagged');
    await expect(
      page.locator('.messages-page__bubble-text', { hasText: 'Listing photos flagged' }),
    ).toHaveCount(0);

    // The plain text message renders as a normal bubble.
    await expect(
      page.locator('.messages-page__bubble-text', { hasText: 'Why was my listing rejected?' }),
    ).toBeVisible();

    await page.getByLabel('Message').fill('Rejected for missing safety notes — please resubmit.');

    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().endsWith('/api/chat/messages') && req.method() === 'POST',
      ),
      page.getByRole('button', { name: 'Send', exact: true }).click(),
    ]);
    expect((request.postDataJSON() as { content?: string }).content).toBe(
      'Rejected for missing safety notes — please resubmit.',
    );

    await expect(
      page.locator('.messages-page__bubble-text', {
        hasText: 'Rejected for missing safety notes — please resubmit.',
      }),
    ).toBeVisible();
    // Composer clears after a successful send.
    await expect(page.getByLabel('Message')).toHaveValue('');
  });

  test('the "Needs reply" filter narrows the visible rows, not just the pill badge count (regression)', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eAdmin(),
      adminMessageThreads: [
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-1',
          memberFirstName: 'Renata',
          memberLastName: 'Renter',
          needsReply: true,
          unreadCount: 2,
        }),
        // Unread, but the LAST message was the admin's own — does not need a reply.
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-2',
          memberFirstName: 'Oskar',
          memberLastName: 'Owner',
          needsReply: false,
          unreadCount: 3,
        }),
        // Neither unread nor needing a reply.
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-3',
          memberFirstName: 'Nara',
          memberLastName: 'Normal',
          needsReply: false,
          unreadCount: 0,
        }),
      ],
    });

    await page.goto('/admin/messages');
    await expect(page.getByText('Renata Renter')).toBeVisible();
    await expect(page.getByText('Oskar Owner')).toBeVisible();
    await expect(page.getByText('Nara Normal')).toBeVisible();

    const filteredRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/messages/threads') && req.url().includes('filter=needsReply'),
    );
    await page.getByRole('button', { name: 'Needs reply' }).click();
    await filteredRequest;

    // This is the exact regression: the buggy backend returned every row regardless of `filter`
    // while still showing the correct pill count. Asserting on the RENDERED ROWS (not the badge)
    // is what makes this test fail against that behaviour.
    await expect(page.getByText('Renata Renter')).toBeVisible();
    await expect(page.getByText('Oskar Owner')).toHaveCount(0);
    await expect(page.getByText('Nara Normal')).toHaveCount(0);

    // The pill's own count is also correct (search-scoped, filter-independent) — but per the bug
    // this was never the part that broke, so it's a secondary assertion, not the load-bearing one.
    await expect(
      page.getByRole('button', { name: 'Needs reply' }).locator('.messages-page__filter-count'),
    ).toHaveText('1');
  });

  /**
   * 22 threads that need a reply (`NeedsReply01..22`) plus 3 that don't (`NoReplyA/B/C`), 25
   * total — one more page than the default `pageSize: 20`. Ordered needsReply-first so the "all"
   * filter's page 1/page 2 split is deterministic (`items[0..19]` / `items[20..24]`).
   */
  function pagingSeedThreads() {
    const needsReply = Array.from({ length: 22 }, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return e2eAdminMessageThread({
        conversationId: `admin-thread-e2e-nr-${n}`,
        memberId: `member-e2e-nr-${n}`,
        memberFirstName: 'Member',
        memberLastName: `NeedsReply${n}`,
        needsReply: true,
        unreadCount: 1,
      });
    });
    const noReply = ['A', 'B', 'C'].map((letter) =>
      e2eAdminMessageThread({
        conversationId: `admin-thread-e2e-plain-${letter}`,
        memberId: `member-e2e-plain-${letter}`,
        memberFirstName: 'Member',
        memberLastName: `NoReply${letter}`,
        needsReply: false,
        unreadCount: 0,
      }),
    );
    return [...needsReply, ...noReply];
  }

  /**
   * Pagination regression coverage: the query-binding bug fixed on the backend meant the whole
   * request DTO — `page`/`pageSize` included, not just `filter` — silently failed to bind
   * whenever `filter=` was present, so the UI pager has never actually been driven past page 1.
   * `api-mock.ts`'s GET handler now genuinely slices by `page`/`pageSize` (see its doc comment)
   * instead of always answering "page 1 of 1" — these two tests are what makes that real slicing
   * matter: they'd fail against either the old always-page-1 mock OR a UI regression that resets
   * the filter/search when paging.
   */
  test('the pager renders a real second page with different rows and the correct totalCount/totalPages', async ({
    page,
  }) => {
    await mockApi(page, { me: e2eAdmin(), adminMessageThreads: pagingSeedThreads() });

    await page.goto('/admin/messages');
    await expect(page.getByText('Member NeedsReply01')).toBeVisible();
    await expect(page.getByText('Member NeedsReply20')).toBeVisible();
    await expect(page.getByText('Member NeedsReply21')).toHaveCount(0);
    await expect(page.getByText('Member NoReplyA')).toHaveCount(0);
    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 1 of 2');
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();

    const page2Request = page.waitForRequest(
      (req) => req.url().includes('/api/admin/messages/threads') && req.url().includes('page=2'),
    );
    await page.getByRole('button', { name: 'Next' }).click();
    await page2Request;

    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 2 of 2');
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
    // Page 2 is genuinely different content (the last 2 needsReply rows + the 3 plain ones),
    // and page 1's rows are gone — not just a re-rendered page-1 list with a relabeled pager.
    await expect(page.getByText('Member NeedsReply01')).toHaveCount(0);
    await expect(page.getByText('Member NeedsReply21')).toBeVisible();
    await expect(page.getByText('Member NeedsReply22')).toBeVisible();
    await expect(page.getByText('Member NoReplyA')).toBeVisible();
    await expect(page.getByText('Member NoReplyB')).toBeVisible();
    await expect(page.getByText('Member NoReplyC')).toBeVisible();
  });

  test('paging while a filter or search is active keeps it applied (regression: the query-binding bug broke exactly this combination)', async ({
    page,
  }) => {
    await mockApi(page, { me: e2eAdmin(), adminMessageThreads: pagingSeedThreads() });

    await page.goto('/admin/messages');
    await expect(page.getByText('Member NeedsReply01')).toBeVisible();

    // ── Filter + page ──
    const filteredFirstPage = page.waitForRequest(
      (req) =>
        req.url().includes('/api/admin/messages/threads') && req.url().includes('filter=needsReply'),
    );
    await page.getByRole('button', { name: 'Needs reply' }).click();
    await filteredFirstPage;
    // Switching filters resets to page 1 of the NARROWER (22-item) set: still 2 pages, but the
    // 3 plain threads are excluded from the count.
    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 1 of 2');

    const filteredSecondPage = page.waitForRequest(
      (req) =>
        req.url().includes('/api/admin/messages/threads') &&
        req.url().includes('filter=needsReply') &&
        req.url().includes('page=2'),
    );
    await page.getByRole('button', { name: 'Next' }).click();
    await filteredSecondPage;

    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 2 of 2');
    // The exact regression shape: page 2 under the "needs reply" filter must be ONLY the 2
    // remaining needsReply rows — not the 3 plain rows that occupied page 2 under "all".
    await expect(page.getByText('Member NeedsReply21')).toBeVisible();
    await expect(page.getByText('Member NeedsReply22')).toBeVisible();
    await expect(page.getByText('Member NoReplyA')).toHaveCount(0);
    await expect(page.getByText('Member NoReplyB')).toHaveCount(0);
    await expect(page.getByText('Member NoReplyC')).toHaveCount(0);

    // ── Search + page (back to the "all" filter first) ──
    const allFirstPage = page.waitForRequest(
      (req) => req.url().includes('/api/admin/messages/threads') && req.url().includes('filter=all'),
    );
    await page.getByRole('button', { name: 'All' }).click();
    await allFirstPage;

    const searchScoped = page.waitForRequest(
      (req) =>
        req.url().includes('/api/admin/messages/threads') && req.url().includes('search=NeedsReply'),
    );
    await page.locator('.messages-page__search-input').fill('NeedsReply');
    await searchScoped;
    // The search alone (22 matches, same set as the filter above) also produces 2 pages.
    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 1 of 2');

    const searchSecondPage = page.waitForRequest(
      (req) =>
        req.url().includes('/api/admin/messages/threads') &&
        req.url().includes('search=NeedsReply') &&
        req.url().includes('page=2'),
    );
    await page.getByRole('button', { name: 'Next' }).click();
    await searchSecondPage;

    await expect(page.locator('.messages-page__pager-status')).toHaveText('Page 2 of 2');
    await expect(page.getByText('Member NeedsReply21')).toBeVisible();
    await expect(page.getByText('Member NeedsReply22')).toBeVisible();
    await expect(page.getByText('Member NoReplyA')).toHaveCount(0);
  });

  test('the thread list surfaces a load error with a working retry, not a stuck skeleton', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eAdmin(),
      adminMessageThreads: [
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-err-1',
          memberFirstName: 'Renata',
          memberLastName: 'Renter',
        }),
      ],
    });

    // Registered AFTER mockApi so it intercepts first (same "spy/override" convention as
    // home-hero-map.spec.ts). `AdminShellComponent` ALSO dispatches its own `loadMessageThreads()`
    // on mount (for the nav badge) alongside this page's own load — both funnel through the same
    // `switchMap`'d effect, so which of the two concurrent requests the store ends up reflecting
    // isn't worth pinning down here. Failing every GET until the flag flips (rather than "only
    // the first") is robust to that race either way.
    let shouldFail = true;
    let getCount = 0;
    await page.route('**/api/admin/messages/threads*', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      getCount += 1;
      if (shouldFail) {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' }),
        });
      }
      return route.fallback();
    });

    await page.goto('/admin/messages');

    const errorBlock = page.locator('.messages-page__list-error');
    await expect(errorBlock).toBeVisible();
    await expect(errorBlock).toContainText('Unable to load conversations');
    await expect(errorBlock).toContainText('Server error');
    await expect(page.getByText('Renata Renter')).toHaveCount(0);

    const countBeforeRetry = getCount;
    shouldFail = false;
    const retryRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/messages/threads') && req.method() === 'GET',
    );
    await page.getByRole('button', { name: 'Try again' }).click();
    await retryRequest;

    // The retry actually re-requested (not a client-side-only error toggle) and recovered.
    await expect(errorBlock).toHaveCount(0);
    await expect(page.getByText('Renata Renter')).toBeVisible();
    expect(getCount).toBeGreaterThan(countBeforeRetry);
  });

  test('the "Needs reply" filter shows the empty state (not a stuck skeleton) when nothing matches', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eAdmin(),
      adminMessageThreads: [
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-empty-1',
          memberFirstName: 'Renata',
          memberLastName: 'Renter',
          needsReply: false,
        }),
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-empty-2',
          memberFirstName: 'Oskar',
          memberLastName: 'Owner',
          needsReply: false,
        }),
      ],
    });

    await page.goto('/admin/messages');
    await expect(page.getByText('Renata Renter')).toBeVisible();

    await page.getByRole('button', { name: 'Needs reply' }).click();

    await expect(page.locator('.messages-page__list-empty')).toBeVisible();
    await expect(page.locator('.messages-page__list-empty')).toHaveText('No conversations here.');
    await expect(page.locator('.messages-page__list')).toHaveCount(0);
    await expect(page.getByText('Renata Renter')).toHaveCount(0);
  });

  test('a `?userId=` deep link the backend rejects fails gracefully — no hang, no broken thread', async ({
    page,
  }) => {
    await mockApi(page, { me: e2eAdmin(), adminMessageThreads: [] });

    // Registered AFTER mockApi: overrides only the POST get-or-create for this one unknown
    // member id, falls back to mockApi's own handler for everything else (GET included).
    await page.route('**/api/admin/messages/threads*', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = (route.request().postDataJSON() as { userId?: string } | null) ?? {};
      if (body.userId !== 'nonexistent-user-e2e-1') return route.fallback();
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Member not found' }),
      });
    });

    await page.goto('/admin/messages?userId=nonexistent-user-e2e-1');

    // Fails gracefully: a toast surfaces the real backend error...
    await expect(page.getByText("Couldn't open conversation")).toBeVisible();
    await expect(page.getByText('Member not found')).toBeVisible();

    // ...the `?userId=` param is stripped regardless of success/failure (no perpetual
    // re-open-on-refresh loop)...
    await expect(page).toHaveURL(/\/admin\/messages$/);

    // ...and the chat panel falls back to its idle state — it never hangs on a perpetual
    // skeleton, and no broken/placeholder thread for the nonexistent member gets created.
    await expect(page.locator('.messages-page__idle')).toBeVisible();
    await expect(page.locator('.messages-page__chat-header-name')).toHaveCount(0);
    await expect(page.getByText('New Member')).toHaveCount(0);
  });

  test('each moderation-note kind renders its own tone and label, not a generic fallback', async ({
    page,
  }) => {
    const kinds: { kind: string; label: string; tone: string }[] = [
      { kind: 'reject', label: 'Listing rejected', tone: 'danger' },
      { kind: 'warn', label: 'Warning issued', tone: 'warn' },
      { kind: 'suspend', label: 'Account suspended', tone: 'danger' },
      { kind: 'category', label: 'Category changed', tone: 'info' },
      { kind: 'info', label: 'Moderation note', tone: 'info' },
    ];

    await mockApi(page, {
      me: e2eAdmin(),
      adminMessageThreads: [
        e2eAdminMessageThread({
          conversationId: 'admin-thread-e2e-kinds-1',
          memberFirstName: 'Renata',
          memberLastName: 'Renter',
        }),
      ],
      chatConversationDetailsById: {
        'admin-thread-e2e-kinds-1': e2eModerationConversationDetails({
          id: 'admin-thread-e2e-kinds-1',
          counterpartId: 'member-e2e-kinds-1',
          counterpartName: 'Renata Renter',
          messages: kinds.map(({ kind }) =>
            e2eModerationNoteMessage({
              id: `note-e2e-${kind}`,
              conversationId: 'admin-thread-e2e-kinds-1',
              noteKind: kind,
              noteSubject: `Subject for ${kind}`,
            }),
          ),
        }),
      },
    });

    await page.goto('/admin/messages');
    await page.locator('.messages-page__row-main').filter({ hasText: 'Renata Renter' }).click();
    await expect(page.locator('.messages-page__chat-header-name')).toContainText('Renata Renter');

    const notes = page.locator('.mod-note');
    await expect(notes).toHaveCount(kinds.length);

    for (const [i, { label, tone }] of kinds.entries()) {
      const note = notes.nth(i);
      await expect(note).toHaveClass(new RegExp(`\\bmod-note--${tone}\\b`));
      await expect(note.locator('.mod-note__kind-label')).toHaveText(label);
    }
  });
});
