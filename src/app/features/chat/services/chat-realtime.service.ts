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
   * Open the hub connection. Idempotent. Call once the user signs in. Lazily
   * loads @microsoft/signalr so the library is never in the initial bundle and
   * only downloads once an authenticated user actually starts realtime.
   */
  start(): void {
    if (this.active) {
      return;
    }
    this.active = true;
    void this.openConnection();
  }

  /** Close the connection. Call on sign-out. Safe whether or not connect finished. */
  stop(): void {
    this.active = false;
    const connection = this.connection;
    this.connection = null;
    connection?.stop().catch(() => {
      /* already tearing down — ignore */
    });
  }

  private async openConnection(): Promise<void> {
    try {
      const signalR = await import('@microsoft/signalr');
      // stop() may have raced in while the chunk was loading.
      if (!this.active) {
        return;
      }

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(toApiUrl(ApiContract.chat.hub), {
          // SignalR appends `?access_token=<jwt>` on the WebSocket handshake and
          // uses the Authorization header on other transports. Reuse the same
          // token source as the HTTP interceptor.
          accessTokenFactory: () => this.authToken.getToken() ?? '',
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

      this.connection = connection;
      await connection.start();

      // stop() may have raced in while the handshake was in flight.
      if (!this.active) {
        this.connection = null;
        await connection.stop().catch(() => {});
      }
    } catch {
      // A failed import or initial handshake must not break the shell. Reset so
      // the next sign-in (or app reload) can retry; the badge poll is the
      // backstop meanwhile.
      this.connection = null;
      this.active = false;
    }
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
    if (!isMine) {
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
