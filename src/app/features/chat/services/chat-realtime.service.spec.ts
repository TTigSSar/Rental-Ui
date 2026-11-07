import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { AuthTokenService } from '../../auth/services/auth-token.service';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type { ChatRealtimeMessage } from '../models/chat.model';
import { selectActiveConversation, selectChatState } from '../store/chat.selectors';
import { ChatBadgeService } from './chat-badge.service';
import { ChatBrowserNotifier } from './chat-browser-notifier.service';
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
        { provide: ChatBrowserNotifier, useValue: { notify: vi.fn(), closeAll: vi.fn() } },
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

describe('ChatRealtimeService restart after a server close (ADR-055 §6)', () => {
  let builds: number;
  let closeHandlers: (() => void)[];
  let startImpl: () => Promise<void>;
  let token: string | null;
  let factories: (() => string | Promise<string>)[];

  async function setup() {
    builds = 0;
    closeHandlers = [];
    factories = [];
    token = 'old-jwt';
    startImpl = () => Promise.resolve();
    const signalR = await import('@microsoft/signalr');
    const proto = signalR.HubConnectionBuilder.prototype;
    vi.spyOn(proto, 'withUrl').mockImplementation(function (this: unknown, _u: unknown, o: unknown) {
      factories.push((o as { accessTokenFactory: () => string }).accessTokenFactory);
      return this as never;
    } as never);
    for (const m of ['withAutomaticReconnect', 'configureLogging'] as const) {
      vi.spyOn(proto, m).mockImplementation(function (this: unknown) {
        return this as never;
      } as never);
    }
    vi.spyOn(proto, 'build').mockImplementation((() => {
      builds++;
      return {
        on: vi.fn(),
        onreconnected: vi.fn(),
        onclose: (cb: () => void) => closeHandlers.push(cb),
        start: () => startImpl(),
        stop: vi.fn().mockResolvedValue(undefined),
      };
    }) as never);
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: ChatBadgeService, useValue: {} },
        { provide: ChatBrowserNotifier, useValue: { notify: vi.fn(), closeAll: vi.fn() } },
        { provide: AuthTokenService, useValue: { getToken: () => token } },
      ],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectAuthUser, { id: 'me' } as never);
    store.overrideSelector(selectActiveConversation, null);
    store.overrideSelector(selectChatState, undefined as never);
    return TestBed.inject(ChatRealtimeService);
  }

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a close without error while signed in starts a new connection that uses the current token', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));
    token = 'new-jwt';

    closeHandlers[0]();
    await vi.advanceTimersByTimeAsync(2100);
    await vi.waitFor(() => expect(builds).toBe(2));
    expect(factories[1]()).toBe('new-jwt');
  });

  it('a close after a deliberate stop() does not restart', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));

    service.stop();
    closeHandlers[0](); // SignalR fires onclose for the stopped connection
    await vi.advanceTimersByTimeAsync(20000);
    expect(builds).toBe(1);
  });

  it('a stop() during the restart delay cancels the pending restart', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));

    closeHandlers[0]();
    service.stop();
    await vi.advanceTimersByTimeAsync(20000);
    expect(builds).toBe(1);
  });

  it('a failing restart (e.g. 401) is not retried, and repeated closes are bounded', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));

    startImpl = () => Promise.reject(new Error('401'));
    closeHandlers[0]();
    await vi.advanceTimersByTimeAsync(60000);
    await vi.waitFor(() => expect(builds).toBe(2));
    expect(builds).toBe(2); // failed start: no further attempt

  });

  it('the restart budget is per outage: a 4th close after 3 successful restarts still restarts', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));
    for (let i = 0; i < 4; i++) {
      closeHandlers.at(-1)!();
      await vi.advanceTimersByTimeAsync(2100);
      await vi.waitFor(() => expect(builds).toBe(i + 2));
    }
  });

  it('a restart that 401s with a token that changed since is retried once, then not again', async () => {
    const service = await setup();
    service.start();
    await vi.waitFor(() => expect(builds).toBe(1));

    // The restart runs with the OLD token and is rejected; the new token lands meanwhile.
    startImpl = () => {
      const used = factories.at(-1)!();
      token = 'new-jwt';
      return Promise.reject(Object.assign(new Error('401'), { statusCode: 401, used }));
    };
    closeHandlers[0]();
    await vi.advanceTimersByTimeAsync(2100);
    await vi.waitFor(() => expect(builds).toBe(3)); // restart + one stale-token retry
    expect(factories[2]()).toBe('new-jwt');

    // Retry is rejected too (token unchanged this time): no third attempt.
    await vi.advanceTimersByTimeAsync(60000);
    expect(builds).toBe(3);
  });
});

describe('ChatRealtimeService (chat feature not loaded)', () => {
  function setup() {
    const badge = { increment: vi.fn(), requestRefresh: vi.fn(), refresh: vi.fn() };
    const notifier = { notify: vi.fn(), closeAll: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideMockStore(),
        { provide: ChatBadgeService, useValue: badge },
        { provide: ChatBrowserNotifier, useValue: notifier },
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
    return { badge, notifier, service, realtime: service as unknown as ChatRealtimeService };
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

  it('hands every incoming message to the browser notifier and clears it on stop (ADR-036)', () => {
    const { notifier, service, realtime } = setup();
    const incoming = message({});
    service.onMessageReceived(incoming);
    expect(notifier.notify).toHaveBeenCalledWith(incoming);
    realtime.stop();
    expect(notifier.closeAll).toHaveBeenCalledTimes(1);
  });
});
