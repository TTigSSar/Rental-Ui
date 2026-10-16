import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable, combineLatest, distinctUntilChanged, filter, map } from 'rxjs';

import { OwnerRequestsBadgeService } from '../../bookings/services/owner-requests-badge.service';
import { ChatBadgeService } from '../../chat/services/chat-badge.service';
import { ChatRealtimeService } from '../../chat/services/chat-realtime.service';
import { NotificationBadgeService } from '../../notifications/services/notification-badge.service';
import { selectAuthUser, selectIsAuthenticated } from '../store/auth.selectors';

/**
 * Owns everything that lives and dies with a signed-in USER: the notification / chat /
 * owner-request badge pollers and the SignalR chat hub. Keyed on the user id, not on the
 * `isAuthenticated` boolean, so a session switch A -> B without a logout (reset-password or
 * verify-email success while A is signed in) tears down A's connections and starts B's, exactly
 * like logout + login. A same-user re-auth keeps the id and restarts nothing.
 */
@Injectable({ providedIn: 'root' })
export class SessionLifecycleService {
  private readonly store = inject(Store);
  private readonly notificationBadge = inject(NotificationBadgeService);
  private readonly chatBadge = inject(ChatBadgeService);
  private readonly chatRealtime = inject(ChatRealtimeService);
  private readonly ownerRequestsBadge = inject(OwnerRequestsBadgeService);

  /** Current session user id (null = signed out). Subscribe with `takeUntilDestroyed`. */
  readonly sessionUserId$: Observable<string | null> = this.sessionUserId();

  /** Apply one identity transition: always tear down, then start for the new user if any. */
  apply(userId: string | null): void {
    this.notificationBadge.stop();
    this.chatBadge.stop();
    this.chatRealtime.stop();
    this.ownerRequestsBadge.stop();
    if (userId !== null) {
      this.notificationBadge.start();
      this.chatBadge.start();
      this.chatRealtime.start();
      this.ownerRequestsBadge.start();
    }
  }

  private sessionUserId(): Observable<string | null> {
    return combineLatest([
      this.store.select(selectIsAuthenticated),
      this.store.select(selectAuthUser),
    ]).pipe(
      // `isAuthenticated && user === null` is the window between a token landing and /auth/me
      // answering (or a transient /auth/me failure that keeps the session). It is not an
      // identity change, so it is held back.
      filter(([authenticated, user]) => !(authenticated && user === null)),
      map(([authenticated, user]) => (authenticated ? (user?.id ?? null) : null)),
      distinctUntilChanged(),
    );
  }
}
