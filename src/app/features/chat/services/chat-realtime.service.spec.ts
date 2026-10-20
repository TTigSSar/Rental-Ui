import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { AuthTokenService } from '../../auth/services/auth-token.service';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { ChatRealtimeMessage } from '../models/chat.model';
import { selectActiveConversation, selectChatState } from '../store/chat.selectors';
import { ChatBadgeService } from './chat-badge.service';
import { ChatRealtimeService } from './chat-realtime.service';

function message(overrides: Partial<ChatRealtimeMessage>): ChatRealtimeMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'other',
    senderName: 'Other',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hi',
    attachmentUrl: null,
    sentAt: '2026-07-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('ChatRealtimeService (chat feature not loaded)', () => {
  function setup() {
    const badge = { increment: vi.fn(), requestRefresh: vi.fn(), refresh: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: ChatBadgeService, useValue: badge },
        { provide: AuthTokenService, useValue: { getToken: () => null } },
      ],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectAuthUser, { id: 'me' } as never);
    store.overrideSelector(selectActiveConversation, null);
    store.overrideSelector(selectChatState, undefined as never);
    const service = TestBed.inject(ChatRealtimeService) as unknown as {
      onMessageReceived(m: ChatRealtimeMessage): void;
    };
    return { badge, service };
  }

  it('refreshes from the server for a system line instead of a local +1', () => {
    const { badge, service } = setup();
    service.onMessageReceived(message({ type: 'system', systemKind: 'approved', senderId: null }));
    expect(badge.requestRefresh).toHaveBeenCalledTimes(1);
    expect(badge.increment).not.toHaveBeenCalled();
  });

  it('still bumps locally for someone elses text message', () => {
    const { badge, service } = setup();
    service.onMessageReceived(message({}));
    expect(badge.increment).toHaveBeenCalledTimes(1);
    expect(badge.requestRefresh).not.toHaveBeenCalled();
  });
});
