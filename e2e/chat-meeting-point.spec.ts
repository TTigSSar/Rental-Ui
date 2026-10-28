import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eChatConversation,
  e2eChatConversationPreview,
  e2eChatMessage,
  e2eHomePoint,
  e2eUser,
} from './support/fixtures';

/**
 * ADR-053 (Trello P3-1): the owner shares the meeting point from an Approved booking chat.
 *
 * Journey: the OWNER taps the pin button -> chooser ("My home point" is preselected) -> "Share
 * home point" posts `{kind:'home'}` -> a "Meeting point" bubble appears in the thread whose link
 * is a Google Maps URL for the owner's home point. The RENTER's view of the same chat has no pin
 * button but renders an existing bubble. Fixture data is static (no dates that expire - M-075);
 * the coordinates come from `e2eHomePoint()`.
 *
 * The "Another place" map-picker error-state regressions (stale send error, close-while-sending)
 * stay pinned by their unit specs; the picker needs real map tiles, which this tier stubs.
 */

const CHAT_ID = 'chat-e2e-mp-1';
const BOOKING_ID = 'booking-e2e-mp-1';
const DESKTOP = { width: 1280, height: 720 };

const approvedChat = (overrides: Record<string, unknown> = {}) =>
  e2eChatConversation({
    id: CHAT_ID,
    bookingId: BOOKING_ID,
    counterpartId: 'renter-e2e-1',
    counterpartName: 'Anna Renter',
    status: 'approved',
    bookingStatus: 'approved',
    viewerRole: 'owner',
    turn: 'owner',
    messages: [
      e2eChatMessage({ id: 'mp-m-1', conversationId: CHAT_ID, senderName: 'Anna Renter' }),
    ],
    ...overrides,
  });

async function seed(page: Page, detail: Record<string, unknown>): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'e2e-jwt-token');
  });
  await mockApi(page, {
    me: e2eUser(),
    chatConversations: [
      e2eChatConversationPreview({
        id: CHAT_ID,
        bookingId: BOOKING_ID,
        counterpartName: 'Anna Renter',
        status: 'approved',
      }),
    ],
    chatConversationDetailsById: { [CHAT_ID]: detail },
  });
}

test.describe('Chat meeting point', () => {
  test.use({ viewport: DESKTOP });

  test('owner shares the home point: a Meeting point bubble with a maps link appears', async ({
    page,
  }) => {
    await seed(page, approvedChat());
    await page.goto(`/chat/${CHAT_ID}`);

    const pin = page.getByRole('button', { name: 'Share meeting point' });
    await expect(pin).toBeVisible();
    await pin.click();

    const dialog = page.getByRole('dialog', { name: 'What do you want to share?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: /My home point/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const posted = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith(`/api/chat/conversations/${CHAT_ID}/meeting-point`),
    );
    await dialog.getByRole('button', { name: 'Share home point' }).click();
    expect((await posted).postDataJSON()).toEqual({ kind: 'home' });

    const bubble = page.getByRole('group', { name: 'Meeting point' });
    await expect(bubble).toBeVisible();
    const home = e2eHomePoint();
    await expect(bubble.getByRole('link', { name: /Open in maps/ })).toHaveAttribute(
      'href',
      `https://www.google.com/maps/search/?api=1&query=${home.latitude},${home.longitude}`,
    );
    await expect(dialog).toBeHidden();
  });

  test('renter sees the shared bubble but has no pin button', async ({ page }) => {
    await seed(
      page,
      approvedChat({
        viewerRole: 'renter',
        turn: 'renter',
        messages: [
          e2eChatMessage({
            id: 'mp-m-2',
            conversationId: CHAT_ID,
            type: 'location',
            body: null,
            latitude: 40.1835,
            longitude: 44.5152,
            meetingPointKind: 'home',
            senderName: 'Olive Owner',
          }),
        ],
      }),
    );
    await page.goto(`/chat/${CHAT_ID}`);

    const bubble = page.getByRole('group', { name: 'Meeting point' });
    await expect(bubble).toBeVisible();
    await expect(bubble.getByRole('link', { name: /Open in maps/ })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=40.1835,44.5152',
    );
    await expect(page.getByRole('button', { name: 'Share meeting point' })).toHaveCount(0);
  });
});
