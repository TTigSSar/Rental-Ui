import { makeAdminMessageThread, makeAdminMessageThreadQueue } from '../../../../testing/fixtures';
import type { ChatConversationDetails, ChatMessage } from '../../chat/models/chat.model';
import * as AdminMessagesActions from './admin-messages.actions';
import { adminMessagesReducer } from './admin-messages.reducer';
import { initialAdminMessagesState, type AdminMessagesState } from './admin-messages.state';

function stateWith(overrides: Partial<AdminMessagesState>): AdminMessagesState {
  return { ...initialAdminMessagesState, ...overrides };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'conv-1',
    senderId: 'user-2',
    senderName: 'Anahit',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-08-13T10:05:00.000Z',
    isMine: false,
    seen: false,
    ...overrides,
  };
}

function makeDetails(overrides: Partial<ChatConversationDetails> = {}): ChatConversationDetails {
  return {
    id: 'conv-1',
    kind: 'moderation',
    bookingId: null,
    counterpartId: 'user-2',
    counterpartName: 'Anahit Grigoryan',
    counterpartAvatarUrl: null,
    counterpartVerified: true,
    toyTitle: null,
    toyImageUrl: null,
    status: 'moderation',
    bookingDates: null,
    bookingPrice: null,
    isClosed: false,
    messages: [],
    ...overrides,
  };
}

describe('adminMessagesReducer', () => {
  describe('queue load', () => {
    it('replaces the queue on success', () => {
      const items = [
        makeAdminMessageThread({ conversationId: 'c1' }),
        makeAdminMessageThread({ conversationId: 'c2' }),
      ];
      const counts = { all: 12, unread: 4, needsReply: 2 };
      const next = adminMessagesReducer(
        stateWith({ isLoading: true }),
        AdminMessagesActions.loadMessageThreadsSuccess({
          queue: makeAdminMessageThreadQueue({ items, totalCount: 2, totalPages: 1, counts }),
        }),
      );
      expect(next.items).toEqual(items);
      expect(next.counts).toEqual(counts);
      expect(next.isLoading).toBe(false);
      expect(next.error).toBeNull();
    });

    it('records the error on failure', () => {
      const next = adminMessagesReducer(
        stateWith({ isLoading: true }),
        AdminMessagesActions.loadMessageThreadsFailure({ error: 'boom' }),
      );
      expect(next.isLoading).toBe(false);
      expect(next.error).toBe('boom');
    });

    it('resets to page 1 when the filter changes', () => {
      const next = adminMessagesReducer(
        stateWith({ page: 3, filter: 'all' }),
        AdminMessagesActions.setMessageThreadFilter({ filter: 'unread' }),
      );
      expect(next.filter).toBe('unread');
      expect(next.page).toBe(1);
    });

    it('resets to page 1 when the search term changes', () => {
      const next = adminMessagesReducer(
        stateWith({ page: 3 }),
        AdminMessagesActions.setMessageThreadSearch({ search: 'anahit' }),
      );
      expect(next.search).toBe('anahit');
      expect(next.page).toBe(1);
    });

    it('sets the page', () => {
      const next = adminMessagesReducer(
        initialAdminMessagesState,
        AdminMessagesActions.setMessageThreadPage({ page: 2 }),
      );
      expect(next.page).toBe(2);
    });
  });

  describe('thread selection / detail', () => {
    it('sets the selected id and starts loading, clearing any previous detail', () => {
      const start = stateWith({ selectedThreadDetail: makeDetails({ id: 'old' }) });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.selectMessageThread({ conversationId: 'c1' }),
      );
      expect(next.selectedThreadId).toBe('c1');
      expect(next.selectedThreadDetail).toBeNull();
      expect(next.detailLoading).toBe(true);
      expect(next.detailError).toBeNull();
    });

    it('stores the detail on success when it matches the current selection', () => {
      const start = stateWith({ selectedThreadId: 'c1', detailLoading: true });
      const conversation = makeDetails({ id: 'c1' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.loadMessageThreadDetailSuccess({ conversation }),
      );
      expect(next.selectedThreadDetail).toEqual(conversation);
      expect(next.detailLoading).toBe(false);
    });

    it('ignores a stale detail response for a thread the admin has since navigated away from', () => {
      const start = stateWith({ selectedThreadId: 'c2', detailLoading: true });
      const staleConversation = makeDetails({ id: 'c1' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.loadMessageThreadDetailSuccess({ conversation: staleConversation }),
      );
      expect(next.selectedThreadDetail).toBeNull();
      expect(next.detailLoading).toBe(false);
    });

    it('records the error on detail failure', () => {
      const next = adminMessagesReducer(
        stateWith({ detailLoading: true }),
        AdminMessagesActions.loadMessageThreadDetailFailure({ error: 'nope' }),
      );
      expect(next.detailLoading).toBe(false);
      expect(next.detailError).toBe('nope');
    });

    it('clears the selection', () => {
      const start = stateWith({
        selectedThreadId: 'c1',
        selectedThreadDetail: makeDetails({ id: 'c1' }),
      });
      const next = adminMessagesReducer(start, AdminMessagesActions.clearSelectedMessageThread());
      expect(next.selectedThreadId).toBeNull();
      expect(next.selectedThreadDetail).toBeNull();
    });
  });

  describe('mark read', () => {
    it('zeroes unreadCount for the target thread', () => {
      const start = stateWith({
        items: [makeAdminMessageThread({ conversationId: 'c1', unreadCount: 3 })],
      });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.markMessageThreadReadSuccess({ conversationId: 'c1' }),
      );
      expect(next.items[0].unreadCount).toBe(0);
    });

    it('removes the row from the Unread tab once read', () => {
      const start = stateWith({
        filter: 'unread',
        items: [makeAdminMessageThread({ conversationId: 'c1', unreadCount: 3 })],
      });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.markMessageThreadReadSuccess({ conversationId: 'c1' }),
      );
      expect(next.items).toEqual([]);
    });

    it('records the error on failure', () => {
      const next = adminMessagesReducer(
        initialAdminMessagesState,
        AdminMessagesActions.markMessageThreadReadFailure({ error: 'boom' }),
      );
      expect(next.error).toBe('boom');
    });
  });

  describe('send', () => {
    it('appends the sent message to the open thread and clears needsReply on the row', () => {
      const start = stateWith({
        sending: true,
        selectedThreadId: 'c1',
        selectedThreadDetail: makeDetails({ id: 'c1', messages: [] }),
        items: [makeAdminMessageThread({ conversationId: 'c1', needsReply: true })],
      });
      const message = makeMessage({ id: 'm2', conversationId: 'c1', isMine: true, body: 'On it' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.sendMessageThreadMessageSuccess({ message }),
      );
      expect(next.selectedThreadDetail?.messages).toEqual([message]);
      expect(next.items[0].lastMessageSnippet).toBe('On it');
      expect(next.items[0].needsReply).toBe(false);
      expect(next.sending).toBe(false);
    });

    it('records the error on failure', () => {
      const next = adminMessagesReducer(
        stateWith({ sending: true }),
        AdminMessagesActions.sendMessageThreadMessageFailure({ error: 'boom' }),
      );
      expect(next.sending).toBe(false);
      expect(next.sendError).toBe('boom');
    });
  });

  describe('open thread for user (get-or-create)', () => {
    it('inserts a brand-new thread at the front of the list', () => {
      const start = stateWith({
        items: [makeAdminMessageThread({ conversationId: 'existing' })],
      });
      const thread = makeAdminMessageThread({ conversationId: 'new' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.openMessageThreadForUserSuccess({ thread }),
      );
      expect(next.items.map((t) => t.conversationId)).toEqual(['new', 'existing']);
      expect(next.opening).toBe(false);
    });

    it('replaces an already-loaded thread rather than duplicating it', () => {
      const start = stateWith({
        items: [makeAdminMessageThread({ conversationId: 'c1', unreadCount: 5 })],
      });
      const thread = makeAdminMessageThread({ conversationId: 'c1', unreadCount: 0 });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.openMessageThreadForUserSuccess({ thread }),
      );
      expect(next.items).toEqual([thread]);
    });

    it('records the error on failure', () => {
      const next = adminMessagesReducer(
        stateWith({ opening: true }),
        AdminMessagesActions.openMessageThreadForUserFailure({ error: 'boom' }),
      );
      expect(next.opening).toBe(false);
      expect(next.openError).toBe('boom');
    });
  });

  describe('realtime message received', () => {
    it('bumps unreadCount and sets needsReply for a message from the member, thread not open', () => {
      const start = stateWith({
        items: [
          makeAdminMessageThread({
            conversationId: 'c1',
            memberId: 'user-2',
            unreadCount: 1,
            needsReply: false,
          }),
        ],
      });
      const message = makeMessage({
        conversationId: 'c1',
        senderId: 'user-2',
        body: 'Are you there?',
      });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadMessageReceived({ message }),
      );
      expect(next.items[0].unreadCount).toBe(2);
      expect(next.items[0].needsReply).toBe(true);
      expect(next.items[0].lastMessageSnippet).toBe('Are you there?');
      expect(next.items[0].lastMessageAt).toBe(message.sentAt);
    });

    it('does not bump unreadCount when the thread is currently open', () => {
      const start = stateWith({
        selectedThreadId: 'c1',
        selectedThreadDetail: null,
        items: [
          makeAdminMessageThread({ conversationId: 'c1', memberId: 'user-2', unreadCount: 0 }),
        ],
      });
      const message = makeMessage({ conversationId: 'c1', senderId: 'user-2' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadMessageReceived({ message }),
      );
      expect(next.items[0].unreadCount).toBe(0);
    });

    it('clears needsReply for a message from the admin/moderator side', () => {
      const start = stateWith({
        items: [
          makeAdminMessageThread({
            conversationId: 'c1',
            memberId: 'user-2',
            needsReply: true,
          }),
        ],
      });
      const message = makeMessage({ conversationId: 'c1', senderId: 'admin-1' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadMessageReceived({ message }),
      );
      expect(next.items[0].needsReply).toBe(false);
      expect(next.items[0].unreadCount).toBe(0);
    });

    it('appends the message to the open thread detail, deduping by id', () => {
      const existing = makeMessage({ id: 'm1' });
      const start = stateWith({
        selectedThreadId: 'c1',
        selectedThreadDetail: makeDetails({ id: 'c1', messages: [existing] }),
        items: [makeAdminMessageThread({ conversationId: 'c1', memberId: 'user-2' })],
      });
      const incoming = makeMessage({ id: 'm2', conversationId: 'c1', senderId: 'user-2' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadMessageReceived({ message: incoming }),
      );
      expect(next.selectedThreadDetail?.messages.map((m) => m.id)).toEqual(['m1', 'm2']);

      const again = adminMessagesReducer(
        next,
        AdminMessagesActions.threadMessageReceived({ message: incoming }),
      );
      expect(again.selectedThreadDetail?.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    });

    it('is a no-op when the thread is not currently loaded', () => {
      const start = stateWith({ items: [makeAdminMessageThread({ conversationId: 'other' })] });
      const message = makeMessage({ conversationId: 'missing' });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadMessageReceived({ message }),
      );
      expect(next.items).toEqual(start.items);
    });
  });

  describe('realtime read received', () => {
    it('zeroes unreadCount when the reader is the admin', () => {
      const start = stateWith({
        items: [makeAdminMessageThread({ conversationId: 'c1', unreadCount: 4 })],
      });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadReadReceived({
          conversationId: 'c1',
          readAtUtc: '2026-08-13T10:00:00.000Z',
          readerIsAdmin: true,
        }),
      );
      expect(next.items[0].unreadCount).toBe(0);
    });

    it('leaves unreadCount untouched when the reader is the member', () => {
      const start = stateWith({
        items: [makeAdminMessageThread({ conversationId: 'c1', unreadCount: 4 })],
      });
      const next = adminMessagesReducer(
        start,
        AdminMessagesActions.threadReadReceived({
          conversationId: 'c1',
          readAtUtc: '2026-08-13T10:00:00.000Z',
          readerIsAdmin: false,
        }),
      );
      expect(next.items[0].unreadCount).toBe(4);
    });
  });
});
