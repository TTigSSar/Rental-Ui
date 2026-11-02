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
    latitude: null,
    longitude: null,
    meetingPointKind: null,
    body: 'Hi',
    attachmentUrl: null,
    sentAt: '2026-07-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('ChatRealtimeService hub token (ADR-055)', () => {
  it('accessTokenFactory reads the token store live, so a reconnect after a password change uses the new token', async () => {
    const signalR = await import('@microsoft/signalr');
    let factory: (() => string | Promise<string>) | undefined;
    vi.spyOn(signalR.HubConnectionBuilder.prototype, 'withUrl').mockImplementation(function (
      this: unknown,
      _url: unknown,
      options: unknown,
    ) {
      factory = (options as { accessTokenFactory?: () => string }).accessTokenFactory;
      return this as never;
    } as never);
    vi.spyOn(signalR.HubConnectionBuilder.prototype, 'withAutomaticReconnect').mockImplementation(
      function (this: unknown) {
        return this as never;
      } as never,
    );
    vi.spyOn(signalR.HubConnectionBuilder.prototype, 'configureLogging').mockImplementation(
      function (this: unknown) {
        return this as never;
      } as never,
    );
    vi.spyOn(signalR.HubConnectionBuilder.prototype, 'build').mockReturnValue({
      on: vi.fn(),
      onreconnected: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    } as never);

    let token: string | null = 'old-jwt';
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: ChatBadgeService, useValue: {} },
        { provide: AuthTokenService, useValue: { getToken: () => token } },
      ],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectAuthUser, { id: 'me' } as never);
    store.overrideSelector(selectActiveConversation, null);
    store.overrideSelector(selectChatState, undefined as never);
    const service = TestBed.inject(ChatRealtimeService);

    service.start();
    await vi.waitFor(() => expect(factory).toBeDefined());
    expect(factory!()).toBe('old-jwt');

    token = 'new-jwt'; // AuthTokenService.saveToken after changePassword
    expect(factory!()).toBe('new-jwt');

    service.stop();
    vi.restoreAllMocks();
  });
});

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
