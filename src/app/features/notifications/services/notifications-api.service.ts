import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  NotificationFeedPage,
  NotificationFilter,
  UnreadCountResponse,
} from '../models/notification.model';

export interface NotificationFeedQuery {
  readonly filter: NotificationFilter;
  /** Opaque pagination cursor from a previous page; omit for the first page. */
  readonly cursor?: string | null;
}

/**
 * Typed client for the notifications feed. Registered at the root so the global
 * unread-count badge (see NotificationBadgeService) can read it without pulling
 * in the lazily-registered feature store.
 *
 * The feed is always scoped to the authenticated user by the backend — the
 * client never passes a user id — so one user can never read another's feed.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  getFeed(query: NotificationFeedQuery): Observable<NotificationFeedPage> {
    let params = new HttpParams().set('filter', query.filter);
    if (query.cursor) {
      params = params.set('cursor', query.cursor);
    }
    return this.http.get<NotificationFeedPage>(
      toApiUrl(ApiContract.notifications.root),
      { params },
    );
  }

  getUnreadCount(): Observable<UnreadCountResponse> {
    return this.http.get<UnreadCountResponse>(
      toApiUrl(ApiContract.notifications.unreadCount),
    );
  }

  markRead(notificationId: string): Observable<void> {
    return this.http.post<void>(
      toApiUrl(ApiContract.notifications.markRead(notificationId)),
      {},
    );
  }

  markAllRead(): Observable<void> {
    return this.http.post<void>(
      toApiUrl(ApiContract.notifications.markAllRead),
      {},
    );
  }
}
