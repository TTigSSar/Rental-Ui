import { expect, test, type Page } from '@playwright/test';

import { mockApi } from './support/api-mock';
import {
  e2eChatConversation,
  e2eChatConversationPreview,
  e2eModerationConversationDetails,
  e2eUser,
} from './support/fixtures';

/**
 * The chat shell's grid must not move while a thread loads (RC-4 re-review). The layout
 * (rental: 24px gutters + 320px rail; otherwise 70px + 380px at this width) is decided from the
 * selected inbox row, which exists before the thread details do. 1366px sits in the 1280-1439
 * band where the two layouts differ most.
 */

const VIEWPORT = { width: 1366, height: 800 };
const DETAILS_DELAY_MS = 1200;

const rental = (id: string) => ({
  preview: e2eChatConversationPreview({ id, bookingId: `b-${id}`, status: 'requested' }),
  details: e2eChatConversation({
    id,
    bookingId: `b-${id}`,
    status: 'requested',
    viewerRole: 'owner',
    turn: 'owner',
  }),
});

async function seed(page: Page): Promise<void> {
  const r1 = rental('chat-r1');
  const r2 = rental('chat-r2');
  const moderation = e2eModerationConversationDetails({ id: 'chat-m1' });
  await page.addInitScript(() => window.localStorage.setItem('auth_token', 'e2e-jwt-token'));
  await mockApi(page, {
    me: e2eUser(),
    chatConversations: [
      r1.preview,
      r2.preview,
      e2eChatConversationPreview({
        id: 'chat-m1',
        kind: 'moderation',
        bookingId: null,
        status: 'moderation',
        toyTitle: null,
      }),
    ],
    chatConversationDetailsById: {
      'chat-r1': r1.details,
      'chat-r2': r2.details,
      'chat-m1': moderation,
    },
  });
  // Registered after the mock, so it runs first: hold the details response, then hand it on.
  await page.route(/\/api\/chat\/conversations\/chat-[a-z0-9]+$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DETAILS_DELAY_MS));
    await route.fallback();
  });
}

async function railBox(page: Page) {
  const box = await page.locator('.chat-shell__rail').boundingBox();
  if (!box) {
    throw new Error('rail not rendered');
  }
  return { x: Math.round(box.x), width: Math.round(box.width) };
}

test.describe('Chat shell grid stability (1366)', () => {
  test.use({ viewport: VIEWPORT });

  test('rental to rental keeps the rail still across the details load', async ({ page }) => {
    await seed(page);
    await page.goto('/chat');
    await expect(page.locator('.chat-shell__rail a').first()).toBeVisible();

    await page.locator('.chat-shell__rail a[href="/chat/chat-r1"]').click();
    await page.waitForURL('**/chat/chat-r1');
    const loading1 = await railBox(page);
    await expect(page.locator('.chat-thread--rental')).toBeVisible({ timeout: 10_000 });
    const loaded1 = await railBox(page);
    expect(loaded1.width).toBe(320);
    expect(loading1).toEqual(loaded1);

    await page.locator('.chat-shell__rail a[href="/chat/chat-r2"]').click();
    await page.waitForURL('**/chat/chat-r2');
    await page.waitForTimeout(200);
    const loading2 = await railBox(page);
    await page.waitForTimeout(DETAILS_DELAY_MS + 400);
    const loaded2 = await railBox(page);
    test.info().annotations.push({
      type: 'rail x/width',
      description: JSON.stringify({ loading1, loaded1, loading2, loaded2 }),
    });
    expect(loading2).toEqual(loaded1);
    expect(loaded2).toEqual(loaded1);
  });

  test('a moderation thread and the empty /chat keep the two-pane layout', async ({ page }) => {
    await seed(page);
    await page.goto('/chat');
    await expect(page.locator('.chat-shell__rail a').first()).toBeVisible();
    const empty = await railBox(page);
    expect(empty.width).toBeGreaterThan(320);

    await page.locator('.chat-shell__rail a[href="/chat/chat-m1"]').click();
    await page.waitForURL('**/chat/chat-m1');
    expect(await railBox(page)).toEqual(empty);
    await page.waitForTimeout(DETAILS_DELAY_MS + 400);
    expect(await railBox(page)).toEqual(empty);
  });
});
