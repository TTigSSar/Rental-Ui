import { Injectable, inject, signal } from '@angular/core';
import { Subscription, timer } from 'rxjs';

import { NotificationsApiService } from './notifications-api.service';

/** How often the global badge re-polls the unread count (ms). */
const POLL_INTERVAL_MS = 60_000;

/**
 * Single source of truth for the *global* unread-notification count that drives
 * the header bell badge. It lives at the root (not in the lazy feature store)
 * because the bell is visible on every screen, including ones that never load
 * the notifications feature.
 *
 * There is no realtime transport in this app yet (chat is plain HTTP), so the
 * badge polls on an interval while the user is authenticated. When a realtime
 * channel is added, publish new-notification events into {@link setUnreadCount}
 * / {@link refresh} instead of relying on the poll (see
 * NOTIFICATIONS_BACKEND_CHANGES.md).
 *
 * The notifications feature keeps this in sync after mark-read / mark-all-read
 * so the badge and the feed never disagree.
 */
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {
  private readonly api = inject(NotificationsApiService);

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

  /** One-off fetch of the authoritative unread count. */
  refresh(): void {
    this.api.getUnreadCount().subscribe({
      next: ({ unreadCount }) =>
        this.unreadCountSignal.set(Math.max(0, unreadCount)),
      // Swallow errors: a transient failure must not break the shell. The next
      // poll tick retries.
      error: () => {},
    });
  }

  /** Optimistically set the count (e.g. after mark-all-read in the feed). */
  setUnreadCount(count: number): void {
    this.unreadCountSignal.set(Math.max(0, count));
  }

  /** Optimistically decrement (e.g. after opening one unread notification). */
  decrement(by = 1): void {
    this.unreadCountSignal.update((current) => Math.max(0, current - by));
  }
}
