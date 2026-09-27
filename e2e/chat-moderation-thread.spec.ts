import { expect, test } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eChatConversationPreview,
  e2eModerationConversationDetails,
  e2eModerationNoteMessage,
  e2eUser,
} from './support/fixtures';

/**
 * A Moderation conversation (`kind === 'moderation'`) is a moderator's direct thread with a
 * member — no linked booking, `bookingId: null`. `conversation-details-page.component.html`
 * guards the booking-only header (toy strip + `[routerLink]="['/bookings', conversation.bookingId]"`)
 * behind `@if (conversation.kind === 'moderation')`, so that link structurally never renders for
 * this kind — `conversation-details-page.component.spec.ts` ("renders the moderation banner
 * instead of the booking toy-strip header") already proves this at the TestBed level, asserting
 * `host.querySelector('.chat-thread__view-booking')` is null.
 *
 * This journey re-proves the same invariant through the REAL router and a REAL click, on the
 * member's own `/chat` screen (never previously exercised by any e2e spec — templates conditionals
 * on `conversation.kind` are otherwise only unit-tested): open a real moderation thread and
 * confirm there is no live anchor anywhere on the page that could ever navigate to `/bookings/null`.
 * A thin, one-scenario addition — it does not re-test the note-card rendering itself (covered by
 * `admin-messages.spec.ts` and the component's own unit specs), only the routing-shaped risk the
 * task flagged.
 */
test.describe('Member chat — moderation thread', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'e2e-jwt-token');
    });
  });

  test('a member opens a moderation thread: no toy strip, no "View booking" link, the note renders as a card', async ({
    page,
  }) => {
    await mockApi(page, {
      me: e2eUser(),
      chatConversations: [
        e2eChatConversationPreview({
          id: 'chat-e2e-moderation-1',
          kind: 'moderation',
          bookingId: null,
          counterpartName: 'DoRent Moderation',
          toyTitle: null,
          toyImageUrl: null,
          status: 'moderation',
          lastMessageType: 'moderationNote',
          lastMessageSnippet: null,
        }),
      ],
      chatConversationDetailsById: {
        'chat-e2e-moderation-1': e2eModerationConversationDetails({
          id: 'chat-e2e-moderation-1',
          counterpartId: 'admin-e2e-1',
          counterpartName: 'DoRent Moderation',
          messages: [
            e2eModerationNoteMessage({
              id: 'note-member-e2e-1',
              conversationId: 'chat-e2e-moderation-1',
              noteKind: 'warn',
              noteSubject: 'Listing photos flagged',
              isMine: false,
            }),
          ],
        }),
      },
    });

    await page.goto('/chat');
    await expect(page.locator('.chat-row__name', { hasText: 'DoRent Moderation' })).toBeVisible();

    await page.locator('.chat-row', { hasText: 'DoRent Moderation' }).click();
    await expect(page).toHaveURL(/\/chat\/chat-e2e-moderation-1$/);

    // The moderation banner renders instead of the booking toy strip...
    await expect(page.locator('.chat-thread__context--moderation')).toBeVisible();
    await expect(page.locator('.chat-thread__toy-img')).toHaveCount(0);

    // ...and — the load-bearing assertion — there is no live "View booking" link anywhere on
    // the page: a real navigation to `/bookings/null` is structurally impossible here, not
    // merely untested.
    await expect(page.locator('.chat-thread__view-booking')).toHaveCount(0);
    await expect(page.locator('a[href*="/bookings/"]')).toHaveCount(0);

    // The moderation note renders as its own card, not a chat bubble.
    await expect(page.locator('.mod-note')).toBeVisible();
    await expect(page.locator('.mod-note__subject')).toContainText('Listing photos flagged');
  });
});
