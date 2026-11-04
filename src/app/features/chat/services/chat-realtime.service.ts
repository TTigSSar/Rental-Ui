import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
// Type-only: erased at compile time, so nothing from @microsoft/signalr lands
// in the initial bundle. The runtime module is loaded dynamically in start().
import type { HubConnection } from '@microsoft/signalr';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import { AuthTokenService } from '../../auth/services/auth-token.service';
import { selectAuthUser } from '../../auth/store/auth.selectors';
import type {
  ChatRealtimeMessage,
  ChatRealtimeReadEvent,
} from '../models/chat.model';
import * as ChatActions from '../store/chat.actions';
import { selectActiveConversation, selectChatState } from '../store/chat.selectors';
import { ChatBadgeService } from './chat-badge.service';

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 2000;

/**
 * Realtime chat transport. Holds a single SignalR connection to the chat hub
 * and funnels hub events into the NgRx chat store. Root-provided (like
 * {@link ChatBadgeService}) because it must run on every screen — the badge and
 * live thread updates are global, not scoped to the lazy chat feature.
 *
 * Lifecycle is gated on auth exactly like {@link ChatBadgeService}: the app
 * shell calls {@link start} on sign-in and {@link stop} on sign-out. Guests
 * never connect.
 */
@Injectable({ providedIn: 'root' })
export class ChatRealtimeService {
  private readonly store = inject(Store);
  private readonly authToken = inject(AuthTokenService);
  private readonly chatBadge = inject(ChatBadgeService);

  private readonly currentUser = this.store.selectSignal(selectAuthUser);
  private readonly activeConversation = this.store.selectSignal(
    selectActiveConversation,
  );
  // `undefined` until the lazy chat feature registers its state slice. While it
  // is undefined nothing else keeps the nav badge live, so this service does.
  private readonly chatState = this.store.selectSignal(selectChatState);

  private connection: HubConnection | null = null;
  /**
   * True between {@link start} and {@link stop}. Guards against double-starts and
   * lets {@link stop} cancel a connect that is still mid-flight (the dynamic
   * import or the handshake hasn't resolved yet).
   */
  private active = false;
  /**
   * Bumped by every {@link start} and {@link stop}. A connect that is still awaiting the
   * dynamic import / handshake compares its own run number, so a stop()+start() pair (a user
   * switch) cannot let the superseded connect carry on and open a second hub as the old user.
   */
  private run = 0;
  /** Consecutive close-driven restarts; reset by a deliberate {@link stop} and whenever a start() resolves. */
  private restarts = 0;
  /** Token handed to SignalR by the latest attempt; null until the factory has run. */
  private lastTokenUsed: string | null = null;
  /** One extra attempt is allowed after a 401 with a since-changed token; reset on success/stop. */
  private staleTokenRetried = false;

  /**
   * Open the hub connection. Idempotent. Call once the user signs in. Lazily
   * loads @microsoft/signalr so the library is never in the initial bundle and
   * only downloads once an authenticated user actually starts realtime.
   */
  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    void this.openConnection(++this.run);
  }

  /** Close the connection. Call on sign-out. Safe whether or not connect finished. */
  stop(): void {
    this.active = false;
    this.run++;
    this.restarts = 0;
    this.staleTokenRetried = false;
    const connection = this.connection;
    this.connection = null;
    connection?.stop().catch(() => {
      /* already tearing down — ignore */
    });
  }

  private async openConnection(run: number): Promise<void> {
    try {
      const signalR = await import('@microsoft/signalr');
      this.lastTokenUsed = null;
      // stop() may have raced in while the chunk was loading.
      if (run !== this.run) {
        return;
      }

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(toApiUrl(ApiContract.chat.hub), {
          // SignalR appends `?access_token=<jwt>` on the WebSocket handshake and
          // uses the Authorization header on other transports. Reuse the same
          // token source as the HTTP interceptor.
          accessTokenFactory: () => {
            const token = this.authToken.getToken() ?? '';
            this.lastTokenUsed = token;
            return token;
          },
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection.on('messageReceived', (message: ChatRealtimeMessage) =>
        this.onMessageReceived(message),
      );
      connection.on('conversationRead', (event: ChatRealtimeReadEvent) =>
        this.store.dispatch(ChatActions.realtimeConversationRead(event)),
      );
      connection.onreconnected(() => this.resync());
      // A server-side Abort() (ADR-055 §6: after a password change) closes the hub WITHOUT an
      // error, which `withAutomaticReconnect()` does not treat as reconnectable.
      connection.onclose(() => this.onClosed(connection, run));

      this.connection = connection;
      await connection.start();

      if (run === this.run) {
        // Connected: the restart budget and the stale-token retry are per outage.
        this.restarts = 0;
        this.staleTokenRetried = false;
      }

      // stop() may have raced in while the handshake was in flight.
      if (run !== this.run) {
        if (this.connection === connection) {
          this.connection = null;
        }
        await connection.stop().catch(() => {});
      }
    } catch (error) {
      // A failed import or initial handshake must not break the shell. Reset so
      // the next sign-in (or app reload) can retry; the badge poll is the
      // backstop meanwhile.
      if (run === this.run) {
        this.connection = null;
        this.active = false;
        // ADR-055 §6: the server aborts the hub before the new token reaches us, so an early
        // restart can 401 with the OLD token. Try once more if the stored token has changed since.
        const current = this.authToken.getToken() ?? '';
        if (
          (error as { statusCode?: number } | null)?.statusCode === 401 &&
          !this.staleTokenRetried &&
          this.lastTokenUsed !== null &&
          current !== '' &&
          current !== this.lastTokenUsed
        ) {
          this.staleTokenRetried = true;
          this.start();
        }
      }
    }
  }

  /**
   * The hub closed for good (server abort, or automatic reconnect gave up). If nobody called
   * {@link stop} meanwhile, start again after a delay so the freshly stored token is used.
   * Bounded: at most {@link MAX_RESTARTS} consecutive restarts (the count resets once a start() resolves) with doubling delay, and a failed
   * start (e.g. 401) never schedules another one — `openConnection`'s catch just goes inactive.
   * Any start()/stop() bumps `run`, so deliberate stops and user switches cancel a pending restart.
   */
  private onClosed(connection: HubConnection, run: number): void {
    if (run !== this.run || !this.active || this.connection !== connection) {
      return;
    }
    if (this.restarts >= MAX_RESTARTS) {
      this.connection = null;
      this.active = false;
      return;
    }
    const delay = RESTART_DELAY_MS * 2 ** this.restarts;
    this.restarts++;
    this.connection = null;
    this.active = false;
    setTimeout(() => {
      if (this.run === run && !this.active) {
        this.start();
      }
    }, delay);
  }

  private onMessageReceived(message: ChatRealtimeMessage): void {
    this.store.dispatch(ChatActions.realtimeMessageReceived({ message }));

    // When the chat feature is loaded, `syncNavBadge$` keeps the badge exact.
    // Otherwise keep it live here: bump for an incoming (not-mine) message.
    if (this.chatState() !== undefined) {
      return;
    }
    const isMine =
      message.senderId !== null && message.senderId === this.currentUser()?.id;
    if (message.type === 'system') {
      // The server does not count a system line for its actor, so a local +1
      // would stick for them: let the server decide.
      this.chatBadge.requestRefresh();
    } else if (!isMine) {
      this.chatBadge.increment();
    }
  }

  private resync(): void {
    // Re-sync the inbox (and the open thread, if any) after missed events.
    this.store.dispatch(ChatActions.loadConversations());
    const active = this.activeConversation();
    if (active !== null) {
      this.store.dispatch(
        ChatActions.loadConversationDetails({ conversationId: active.id }),
      );
    }
    // If the feature is not loaded, the dispatches above are no-ops; refresh the
    // badge directly so it recovers after a reconnect.
    if (this.chatState() === undefined) {
      this.chatBadge.refresh();
    }
  }
}
