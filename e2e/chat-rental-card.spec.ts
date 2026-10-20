import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eChatConversation,
  e2eChatConversationPreview,
  e2eChatMessage,
  e2eUser,
} from './support/fixtures';

/**
 * RC-3: the rental card in the chat thread - its layout (right column on desktop, pinned and
 * collapsible on a phone), the owner's Accept journey, and the read-only footer.
 *
 * The journey: the OWNER opens a Pending request -> the card says "Your turn" and offers
 * Accept -> Accept posts `/api/bookings/{id}/approve`, the mock flips the stored chat details
 * to Approved, the card re-fetches and now shows the Approved state ("I handed it over").
 *
 * Assertions read what the user sees (M-053): visible text and roles. The one exception is the
 * 5px top bar, which is purely decorative (aria-hidden), so it is checked by its class.
 * Viewports follow the project convention: 1280x720 is the project default (desktop), 390x844
 * the phone used by the other mobile specs.
 */

const CHAT_ID = 'chat-e2e-rc-1';
const BOOKING_ID = 'booking-e2e-rc-1';
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 720 };

const ownerPending = (overrides: Record<string, unknown> = {}) =>
  e2eChatConversation({
    id: CHAT_ID,
    bookingId: BOOKING_ID,
    counterpartId: 'renter-e2e-1',
    counterpartName: 'Anna Renter',
    status: 'requested',
    viewerRole: 'owner',
    turn: 'owner',
    messages: [
      e2eChatMessage({ id: 'rc-m-1', conversationId: CHAT_ID, senderName: 'Anna Renter' }),
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
        status: detail['status'],
      }),
    ],
    chatConversationDetailsById: { [CHAT_ID]: detail },
  });
}

/** Elements of the rental card exist twice on a phone (full + compact layer); only one is visible. */
const visibleText = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true });

async function waitForBootScreenHidden(page: Page): Promise<void> {
  await expect(page.locator('.dr-boot')).toHaveClass(/dr-boot--hidden/, { timeout: 5_000 });
}

for (const [name, viewport] of [
  ['desktop 1280', DESKTOP],
  ['mobile 390', MOBILE],
] as const) {
  test.describe(`Chat rental card - owner Accept journey (${name})`, () => {
    test.use({ viewport });

    test('a Pending request shows "Your turn"; Accept moves the card to the Approved state', async ({
      page,
    }) => {
      await seed(page, ownerPending());

      // Cold direct navigation straight into the thread (M-009: must not crash).
      await page.goto(`/chat/${CHAT_ID}`);
      if (viewport.width < 768) {
        await waitForBootScreenHidden(page);
      }

      await expect(visibleText(page, /^Your turn/)).toBeVisible();
      await expect(visibleText(page, /Anna Renter wants to rent this toy/)).toBeVisible();
      await expect(page.locator('.rental-card__bar')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Accept' }).filter({ visible: true }),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Accept' }).filter({ visible: true }).click();

      await expect(
        page.getByRole('button', { name: 'I handed it over' }).filter({ visible: true }),
      ).toBeVisible();
      await expect(visibleText(page, /^Agreed/)).toBeVisible();
      await expect(visibleText(page, /^Your turn/)).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Accept' }).filter({ visible: true }),
      ).toHaveCount(0);
    });
  });
}

test.describe('Chat rental card - layout', () => {
  test('desktop: the full card sits in a "Rental" column next to the thread and the list', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await seed(page, ownerPending({ renterNote: 'Please wrap it as a gift' }));
    await page.goto(`/chat/${CHAT_ID}`);

    const column = page.getByRole('heading', { name: 'Rental' });
    await expect(column).toBeVisible();
    const card = page.getByRole('region', { name: 'Rental' });
    await expect(card).toBeVisible();
    await expect(card.getByText('E2E Wooden Train Set')).toBeVisible();
    await expect(card.getByText('Please wrap it as a gift')).toBeVisible();

    // Three columns, left to right: the conversation list, the thread, the card column.
    const list = await page.getByText('Anna Renter').first().boundingBox();
    const thread = await page.getByRole('heading', { level: 1, name: 'Anna Renter' }).boundingBox();
    const cardBox = await card.boundingBox();
    expect(list!.x).toBeLessThan(thread!.x);
    expect(thread!.x).toBeLessThan(cardBox!.x);
    expect(cardBox!.width).toBeGreaterThanOrEqual(350);
  });

  test('mobile: scrolling the feed up collapses the card to a compact row; tapping the row expands it', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    const messages = Array.from({ length: 40 }, (_, i) =>
      e2eChatMessage({
        id: `rc-scroll-${i}`,
        conversationId: CHAT_ID,
        body: `Message number ${i}`,
        sentAt: `2026-08-01T10:${String(i).padStart(2, '0')}:00.000Z`,
      }),
    );
    await seed(page, ownerPending({ messages }));
    await page.goto(`/chat/${CHAT_ID}`);
    await waitForBootScreenHidden(page);

    // At the bottom of the feed the card is the full one.
    await expect(
      page.getByRole('button', { name: 'Decline' }).filter({ visible: true }),
    ).toBeVisible();

    // Reading history: scroll the feed to the top.
    await page.locator('.chat-thread__messages').evaluate((el) => {
      el.scrollTop = 0;
    });

    const toggle = page.getByRole('button', { expanded: false }).filter({ hasText: 'Your turn' });
    await expect(toggle).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Decline' }).filter({ visible: true }),
    ).toHaveCount(0);
    // The primary action stays one tap away, as its own 44px target.
    const accept = page.getByRole('button', { name: 'Accept' }).filter({ visible: true });
    await expect(accept).toBeVisible();
    expect((await accept.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await toggle.click();
    await expect(
      page.getByRole('button', { name: 'Decline' }).filter({ visible: true }),
    ).toBeVisible();
  });

  test("mobile: the owner's Pending card with a note starts expanded (their turn is never collapsed for height)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await seed(page, ownerPending({ renterNote: 'Please wrap it as a gift' }));
    await page.goto(`/chat/${CHAT_ID}`);
    await waitForBootScreenHidden(page);
    // Give the first measurement and any (wrongly) triggered collapse time to happen.
    await page.waitForTimeout(1000);

    await expect(visibleText(page, 'Please wrap it as a gift')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Accept' }).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Decline' }).filter({ visible: true }),
    ).toBeVisible();
  });

  test('a finished rental replaces the composer with the read-only note', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seed(
      page,
      ownerPending({
        status: 'completed',
        bookingStatus: 'completed',
        turn: 'none',
        isClosed: true,
      }),
    );
    await page.goto(`/chat/${CHAT_ID}`);

    await expect(page.getByText('This rental is finished. The chat is read-only.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0);
  });
});
