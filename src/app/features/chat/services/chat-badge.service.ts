import { Injectable, inject, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

import { ChatApiService } from './chat-api.service';

/** How often the global badge re-polls the unread count (ms). */
const POLL_INTERVAL_MS = 60_000;

/**
 * Single source of truth for the *global* unread-chat count that drives the
 * header messages badge and the mobile bottom-nav Messages tab. It lives at the
 * root (not in the lazy chat store) because the entry points are visible on
 * every screen, including ones that never load the chat feature.
 *
 * Mirrors {@link NotificationBadgeService}: there is no realtime transport in
 * this app yet, so the badge polls on an interval while the user is
 * authenticated. The count is the SUM of `unreadCount` across the user's
 * conversations (`GET /api/chat/conversations`) — there is no dedicated
 * unread-count endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ChatBadgeService {
  private readonly api = inject(ChatApiService);

  private readonly unreadCountSignal = signal(0);
  /** Readonly view for consumers (the app shell). */
  readonly unreadCount = this.unreadCountSignal.asReadonly();

  private pollSubscription: Subscription | null = null;

  /** Begin polling the unread count. Idempotent. Call once the user signs in. */
  start(): void {
    if (this.pollSubscription !== null) {
      return;
    }
    this.pollSubscription = timer(0, POLL_INTERVAL_MS).subscribe(() =>
      this.refresh(),
    );
  }

  /** Stop polling and clear the badge. Call on sign-out. */
  stop(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = null;
    this.unreadCountSignal.set(0);
  }

  /** One-off fetch of the authoritative unread count across all conversations. */
  refresh(): void {
    this.api.getConversations().subscribe({
      next: (conversations) => {
        const total = conversations.reduce(
          (sum, c) => sum + Math.max(0, c.unreadCount),
          0,
        );
        this.unreadCountSignal.set(total);
      },
      // Swallow errors: a transient failure must not break the shell. The next
      // poll tick retries.
      error: () => {},
    });
  }

  /** Optimistically set the count (e.g. after opening a conversation). */
  setUnreadCount(count: number): void {
    this.unreadCountSignal.set(Math.max(0, count));
  }

  /**
   * Optimistically bump the count by one. Used by {@link ChatRealtimeService}
   * for an incoming message arriving while the lazy chat store is not loaded
   * (nothing else can keep the badge live in that case).
   */
  increment(by = 1): void {
    this.unreadCountSignal.update((current) => Math.max(0, current + by));
  }
}
