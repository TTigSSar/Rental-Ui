import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { ChatConversationDetails, ChatRealtimeMessage } from '../models/chat.model';
import { ChatBadgeService } from '../services/chat-badge.service';
import { ChatApiService } from '../services/chat-api.service';
import * as ChatActions from './chat.actions';
import { ChatEffects } from './chat.effects';
import { selectActiveConversation } from './chat.selectors';

function makeRealtimeMessage(overrides: Partial<ChatRealtimeMessage> = {}): ChatRealtimeMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'owner-1',
    senderName: 'Owner',
    type: 'text',
    systemKind: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-07-08T10:00:00.000Z',
    ...overrides,
  };
}

function makeActiveConversation(
  overrides: Partial<ChatConversationDetails> = {},
): ChatConversationDetails {
  return {
    id: 'c1',
    bookingId: 'b1',
    counterpartName: 'Owner',
    counterpartAvatarUrl: null,
    counterpartVerified: false,
    toyTitle: 'Wooden Train',
    toyImageUrl: null,
    status: 'active',
    bookingDates: 'Jul 1 – Jul 3',
    bookingPrice: 10,
    isClosed: false,
    messages: [],
    ...overrides,
  };
}

function setup() {
  const harness = actionsHarness();
  TestBed.configureTestingModule({
    providers: [
      ChatEffects,
      harness.provider,
      provideMockStore(),
      { provide: ChatApiService, useValue: {} },
      { provide: ChatBadgeService, useValue: { setUnreadCount: vi.fn() } },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectAuthUser, { id: 'renter-1' } as never);
  store.overrideSelector(selectActiveConversation, makeActiveConversation());
  return { harness, store, effects: TestBed.inject(ChatEffects) };
}

describe('ChatEffects', () => {
  describe('realtimeMessageReceived$', () => {
    it('re-fetches conversation details for a SYSTEM message in the open thread (M-007)', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectActiveConversation, makeActiveConversation({ id: 'c1' }));
      store.refreshState();

      const result = collect(effects.realtimeMessageReceived$);
      harness.send(
        ChatActions.realtimeMessageReceived({
          message: makeRealtimeMessage({
            id: 'sys-1',
            type: 'system',
            systemKind: 'closed',
            senderId: null,
            body: 'The rental is complete.',
          }),
        }),
      );
      harness.complete();

      const emitted = await result;
      expect(
        emitted.some(
          (action) =>
            action.type === ChatActions.loadConversationDetails.type &&
            (action as { conversationId: string }).conversationId === 'c1',
        ),
      ).toBe(true);
      // The resolved message is still appended alongside the re-fetch.
      expect(
        emitted.some((action) => action.type === ChatActions.realtimeMessageResolved.type),
      ).toBe(true);
    });

    it('does NOT re-fetch details for an ordinary TEXT message', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectActiveConversation, makeActiveConversation({ id: 'c1' }));
      store.refreshState();

      const result = collect(effects.realtimeMessageReceived$);
      harness.send(
        ChatActions.realtimeMessageReceived({
          message: makeRealtimeMessage({ type: 'text' }),
        }),
      );
      harness.complete();

      const emitted = await result;
      expect(
        emitted.some((action) => action.type === ChatActions.loadConversationDetails.type),
      ).toBe(false);
    });

    it('does NOT re-fetch details for a SYSTEM message in a NON-open conversation', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(
        selectActiveConversation,
        makeActiveConversation({ id: 'other-conversation' }),
      );
      store.refreshState();

      const result = collect(effects.realtimeMessageReceived$);
      harness.send(
        ChatActions.realtimeMessageReceived({
          message: makeRealtimeMessage({
            id: 'sys-2',
            conversationId: 'c1',
            type: 'system',
            systemKind: 'closed',
          }),
        }),
      );
      harness.complete();

      const emitted = await result;
      expect(
        emitted.some((action) => action.type === ChatActions.loadConversationDetails.type),
      ).toBe(false);
    });
  });
});
