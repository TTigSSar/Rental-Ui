import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import { makeAdminMessageThread, makeAdminMessageThreadQueue } from '../../../../testing/fixtures';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { ChatConversationDetails, ChatMessage, ChatRealtimeMessage } from '../../chat/models/chat.model';
import { ChatApiService } from '../../chat/services/chat-api.service';
import * as ChatActions from '../../chat/store/chat.actions';
import { AdminMessagesApiService } from '../services/admin-messages-api.service';
import * as AdminMessagesActions from './admin-messages.actions';
import { AdminMessagesEffects } from './admin-messages.effects';
import { adminMessagesFeatureKey } from './admin-messages.reducer';
import { initialAdminMessagesState, type AdminMessagesState } from './admin-messages.state';

function makeRealtimeMessage(overrides: Partial<ChatRealtimeMessage> = {}): ChatRealtimeMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'user-2',
    senderName: 'Anahit',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-08-13T10:00:00.000Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'user-2',
    senderName: 'Anahit',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-08-13T10:00:00.000Z',
    isMine: false,
    seen: false,
    ...overrides,
  };
}

function makeDetails(overrides: Partial<ChatConversationDetails> = {}): ChatConversationDetails {
  return {
    id: 'c1',
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

function setup(
  apis: { messagesApi?: Partial<AdminMessagesApiService>; chatApi?: Partial<ChatApiService> } = {},
  initialState: AdminMessagesState = initialAdminMessagesState,
) {
  const harness = actionsHarness();
  const messageService = { add: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      AdminMessagesEffects,
      harness.provider,
      provideMockStore({
        initialState: { [adminMessagesFeatureKey]: initialState },
      }),
      { provide: AdminMessagesApiService, useValue: apis.messagesApi ?? {} },
      { provide: ChatApiService, useValue: apis.chatApi ?? {} },
      { provide: MessageService, useValue: messageService },
      { provide: TranslateService, useValue: { instant: (k: string) => k } },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectAuthUser, { id: 'admin-1' } as never);
  return { harness, store, messageService, effects: TestBed.inject(AdminMessagesEffects) };
}

describe('AdminMessagesEffects', () => {
  it('loads the thread queue using the current request params', async () => {
    const queue = makeAdminMessageThreadQueue({ items: [makeAdminMessageThread()] });
    const getThreads = vi.fn().mockReturnValue(of(queue));
    const { harness, effects } = setup({ messagesApi: { getThreads } });
    const result = collect(effects.loadMessageThreads$);
    harness.send(AdminMessagesActions.loadMessageThreads());
    harness.complete();
    expect(await result).toEqual([AdminMessagesActions.loadMessageThreadsSuccess({ queue })]);
    expect(getThreads).toHaveBeenCalledWith({ filter: 'all', search: '', page: 1, pageSize: 20 });
  });

  it('emits failure when the queue request errors', async () => {
    const { harness, effects } = setup({
      messagesApi: { getThreads: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) },
    });
    const result = collect(effects.loadMessageThreads$);
    harness.send(AdminMessagesActions.loadMessageThreads());
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.loadMessageThreadsFailure({ error: 'boom' }),
    ]);
  });

  it('re-dispatches loadMessageThreads on filter/search/page changes', async () => {
    const { harness, effects } = setup();
    const result = collect(effects.reloadOnFilterChange$);
    harness.send(AdminMessagesActions.setMessageThreadFilter({ filter: 'needsReply' }));
    harness.send(AdminMessagesActions.setMessageThreadSearch({ search: 'anahit' }));
    harness.send(AdminMessagesActions.setMessageThreadPage({ page: 2 }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.loadMessageThreads(),
      AdminMessagesActions.loadMessageThreads(),
      AdminMessagesActions.loadMessageThreads(),
    ]);
  });

  it('loads the thread detail via ChatApiService on selection', async () => {
    const conversation = makeDetails({ id: 'c1' });
    const getConversationDetails = vi.fn().mockReturnValue(of(conversation));
    const { harness, effects } = setup({ chatApi: { getConversationDetails } });
    const result = collect(effects.loadThreadDetail$);
    harness.send(AdminMessagesActions.selectMessageThread({ conversationId: 'c1' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.loadMessageThreadDetailSuccess({ conversation }),
    ]);
    expect(getConversationDetails).toHaveBeenCalledWith('c1');
  });

  it('emits detail failure on error', async () => {
    const { harness, effects } = setup({
      chatApi: { getConversationDetails: vi.fn().mockReturnValue(throwError(() => new Error('nope'))) },
    });
    const result = collect(effects.loadThreadDetail$);
    harness.send(AdminMessagesActions.selectMessageThread({ conversationId: 'c1' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.loadMessageThreadDetailFailure({ error: 'nope' }),
    ]);
  });

  it('marks the thread read as soon as it is selected', async () => {
    const { harness, effects } = setup();
    const result = collect(effects.markReadOnSelect$);
    harness.send(AdminMessagesActions.selectMessageThread({ conversationId: 'c1' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.markMessageThreadRead({ conversationId: 'c1' }),
    ]);
  });

  it('calls ChatApiService.markRead and emits success', async () => {
    const markRead = vi.fn().mockReturnValue(of(undefined));
    const { harness, effects } = setup({ chatApi: { markRead } });
    const result = collect(effects.markThreadRead$);
    harness.send(AdminMessagesActions.markMessageThreadRead({ conversationId: 'c1' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.markMessageThreadReadSuccess({ conversationId: 'c1' }),
    ]);
    expect(markRead).toHaveBeenCalledWith('c1');
  });

  it('emits mark-read failure on error', async () => {
    const { harness, effects } = setup({
      chatApi: { markRead: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) },
    });
    const result = collect(effects.markThreadRead$);
    harness.send(AdminMessagesActions.markMessageThreadRead({ conversationId: 'c1' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.markMessageThreadReadFailure({ error: 'boom' }),
    ]);
  });

  it('sends the message via ChatApiService', async () => {
    const message = makeMessage({ id: 'm2', body: 'On it', isMine: true });
    const sendMessage = vi.fn().mockReturnValue(of(message));
    const { harness, effects } = setup({ chatApi: { sendMessage } });
    const result = collect(effects.sendMessage$);
    harness.send(
      AdminMessagesActions.sendMessageThreadMessage({ conversationId: 'c1', content: 'On it' }),
    );
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.sendMessageThreadMessageSuccess({ message }),
    ]);
    expect(sendMessage).toHaveBeenCalledWith('c1', 'On it');
  });

  it('emits send failure on error', async () => {
    const { harness, effects } = setup({
      chatApi: { sendMessage: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) },
    });
    const result = collect(effects.sendMessage$);
    harness.send(
      AdminMessagesActions.sendMessageThreadMessage({ conversationId: 'c1', content: 'hi' }),
    );
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.sendMessageThreadMessageFailure({ error: 'boom' }),
    ]);
  });

  it('opens (get-or-creates) the thread for a user', async () => {
    const thread = makeAdminMessageThread({ conversationId: 'c9' });
    const openThreadForUser = vi.fn().mockReturnValue(of(thread));
    const { harness, effects } = setup({ messagesApi: { openThreadForUser } });
    const result = collect(effects.openThreadForUser$);
    harness.send(AdminMessagesActions.openMessageThreadForUser({ userId: 'user-9' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.openMessageThreadForUserSuccess({ thread }),
    ]);
    expect(openThreadForUser).toHaveBeenCalledWith('user-9');
  });

  it('emits open failure on error', async () => {
    const { harness, effects } = setup({
      messagesApi: { openThreadForUser: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) },
    });
    const result = collect(effects.openThreadForUser$);
    harness.send(AdminMessagesActions.openMessageThreadForUser({ userId: 'user-9' }));
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.openMessageThreadForUserFailure({ error: 'boom' }),
    ]);
  });

  it('selects the thread once it has been opened', async () => {
    const { harness, effects } = setup();
    const result = collect(effects.selectAfterOpen$);
    harness.send(
      AdminMessagesActions.openMessageThreadForUserSuccess({
        thread: makeAdminMessageThread({ conversationId: 'c9' }),
      }),
    );
    harness.complete();
    expect(await result).toEqual([
      AdminMessagesActions.selectMessageThread({ conversationId: 'c9' }),
    ]);
  });

  describe('realtime', () => {
    it('resolves a raw hub message against the current user and re-dispatches it as a thread message', async () => {
      const { harness, effects } = setup();
      const result = collect(effects.realtimeMessage$);
      harness.send(
        ChatActions.realtimeMessageReceived({ message: makeRealtimeMessage({ senderId: 'admin-1' }) }),
      );
      harness.complete();
      expect(await result).toEqual([
        AdminMessagesActions.threadMessageReceived({
          message: makeMessage({ senderId: 'admin-1', isMine: true, seen: false }),
        }),
      ]);
    });

    it('resolves the conversationRead reader identity against the current admin', async () => {
      const { harness, effects } = setup();
      const result = collect(effects.realtimeRead$);
      harness.send(
        ChatActions.realtimeConversationRead({
          conversationId: 'c1',
          readerUserId: 'admin-1',
          readAtUtc: '2026-08-13T10:00:00.000Z',
        }),
      );
      harness.complete();
      expect(await result).toEqual([
        AdminMessagesActions.threadReadReceived({
          conversationId: 'c1',
          readAtUtc: '2026-08-13T10:00:00.000Z',
          readerIsAdmin: true,
        }),
      ]);
    });

    it('a realtime message for a thread in the list updates that thread preview/unread (integration through the reducer contract)', async () => {
      // This effect only re-dispatches; the reducer test suite covers the resulting state
      // mutation. Here we assert the effect emits the exact action the reducer expects.
      const { harness, effects } = setup();
      const result = collect(effects.realtimeMessage$);
      const raw = makeRealtimeMessage({ conversationId: 'c1', senderId: 'user-2', body: 'Ping' });
      harness.send(ChatActions.realtimeMessageReceived({ message: raw }));
      harness.complete();
      expect(await result).toEqual([
        AdminMessagesActions.threadMessageReceived({
          message: { ...raw, isMine: false, seen: false },
        }),
      ]);
    });

    it('marks the open thread read when a realtime message arrives from that thread member', async () => {
      const { harness, effects } = setup(
        {},
        {
          ...initialAdminMessagesState,
          selectedThreadId: 'c1',
          items: [makeAdminMessageThread({ conversationId: 'c1', memberId: 'user-2' })],
        },
      );
      const result = collect(effects.markReadOnLiveThread$);
      harness.send(
        AdminMessagesActions.threadMessageReceived({
          message: makeMessage({ conversationId: 'c1', senderId: 'user-2' }),
        }),
      );
      harness.complete();
      expect(await result).toEqual([
        AdminMessagesActions.markMessageThreadRead({ conversationId: 'c1' }),
      ]);
    });

    it('does not mark read when the realtime message is from the admin side', async () => {
      const { harness, effects } = setup(
        {},
        {
          ...initialAdminMessagesState,
          selectedThreadId: 'c1',
          items: [makeAdminMessageThread({ conversationId: 'c1', memberId: 'user-2' })],
        },
      );
      const result = collect(effects.markReadOnLiveThread$);
      harness.send(
        AdminMessagesActions.threadMessageReceived({
          message: makeMessage({ conversationId: 'c1', senderId: 'admin-1' }),
        }),
      );
      harness.complete();
      expect(await result).toEqual([]);
    });

    it('does not mark read when the message is for a thread that is not open', async () => {
      const { harness, effects } = setup(
        {},
        {
          ...initialAdminMessagesState,
          selectedThreadId: 'c2',
          items: [makeAdminMessageThread({ conversationId: 'c1', memberId: 'user-2' })],
        },
      );
      const result = collect(effects.markReadOnLiveThread$);
      harness.send(
        AdminMessagesActions.threadMessageReceived({
          message: makeMessage({ conversationId: 'c1', senderId: 'user-2' }),
        }),
      );
      harness.complete();
      expect(await result).toEqual([]);
    });
  });

  describe('toasts', () => {
    it('shows an error toast when sending fails', () => {
      const { harness, effects, messageService } = setup();
      TestBed.runInInjectionContext(() => effects.sendFailureToast$.subscribe());
      harness.send(AdminMessagesActions.sendMessageThreadMessageFailure({ error: 'boom' }));
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'boom' }),
      );
    });

    it('shows an error toast when opening a thread fails', () => {
      const { harness, effects, messageService } = setup();
      TestBed.runInInjectionContext(() => effects.openFailureToast$.subscribe());
      harness.send(AdminMessagesActions.openMessageThreadForUserFailure({ error: 'boom' }));
      expect(messageService.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'boom' }),
      );
    });
  });
});
