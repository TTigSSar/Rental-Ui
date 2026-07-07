import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ChatMessage,
} from '../models/chat.model';
import * as ChatActions from './chat.actions';
import { chatReducer } from './chat.reducer';
import { initialChatState, type ChatState } from './chat.state';

function makePreview(
  overrides: Partial<ChatConversationPreview> = {},
): ChatConversationPreview {
  return {
    id: 'c1',
    bookingId: 'b1',
    counterpartName: 'Owner',
    counterpartAvatarUrl: null,
    toyTitle: 'Wooden Train',
    toyImageUrl: null,
    status: 'active',
    lastMessageSnippet: 'See you soon',
    lastMessageAt: '2026-07-07T10:00:00.000Z',
    unreadCount: 3,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'user-1',
    senderName: 'Ada',
    type: 'text',
    systemKind: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-07-07T10:05:00.000Z',
    isMine: true,
    seen: false,
    ...overrides,
  };
}

function makeDetails(
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

function stateWith(overrides: Partial<ChatState>): ChatState {
  return { ...initialChatState, ...overrides };
}

describe('chatReducer', () => {
  describe('markConversationRead', () => {
    it('zeroes unreadCount for the target conversation only', () => {
      const start = stateWith({
        conversations: [
          makePreview({ id: 'c1', unreadCount: 3 }),
          makePreview({ id: 'c2', unreadCount: 5 }),
        ],
      });

      const next = chatReducer(
        start,
        ChatActions.markConversationRead({ conversationId: 'c1' }),
      );

      expect(next.conversations.find((c) => c.id === 'c1')?.unreadCount).toBe(0);
      expect(next.conversations.find((c) => c.id === 'c2')?.unreadCount).toBe(5);
    });

    it('leaves conversations untouched when no id matches', () => {
      const start = stateWith({
        conversations: [makePreview({ id: 'c1', unreadCount: 3 })],
      });

      const next = chatReducer(
        start,
        ChatActions.markConversationRead({ conversationId: 'missing' }),
      );

      expect(next.conversations[0].unreadCount).toBe(3);
    });
  });

  describe('sendMessageSuccess', () => {
    it('appends the returned message to the active conversation', () => {
      const existing = makeMessage({ id: 'm1' });
      const start = stateWith({
        activeConversation: makeDetails({ id: 'c1', messages: [existing] }),
        sendingMessage: true,
      });
      const incoming = makeMessage({ id: 'm2', conversationId: 'c1', body: 'Bye' });

      const next = chatReducer(
        start,
        ChatActions.sendMessageSuccess({ message: incoming }),
      );

      expect(next.activeConversation?.messages.map((m) => m.id)).toEqual([
        'm1',
        'm2',
      ]);
      expect(next.sendingMessage).toBe(false);
      expect(next.sendingMessageError).toBeNull();
    });

    it('does not append when the message targets a different conversation', () => {
      const start = stateWith({
        activeConversation: makeDetails({ id: 'c1', messages: [] }),
        sendingMessage: true,
      });
      const incoming = makeMessage({ id: 'm2', conversationId: 'c-other' });

      const next = chatReducer(
        start,
        ChatActions.sendMessageSuccess({ message: incoming }),
      );

      expect(next.activeConversation?.messages).toEqual([]);
      expect(next.sendingMessage).toBe(false);
    });

    it('does not throw when there is no active conversation', () => {
      const next = chatReducer(
        stateWith({ sendingMessage: true }),
        ChatActions.sendMessageSuccess({ message: makeMessage() }),
      );

      expect(next.activeConversation).toBeNull();
      expect(next.sendingMessage).toBe(false);
    });
  });
});
