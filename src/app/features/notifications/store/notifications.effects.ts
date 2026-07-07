import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { EMPTY, catchError, map, mergeMap, of, switchMap, tap, withLatestFrom } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { NotificationBadgeService } from '../services/notification-badge.service';
import { NotificationsApiService } from '../services/notifications-api.service';
import * as NotificationsActions from './notifications.actions';
import {
  selectNotificationFilter,
  selectNotificationItems,
  selectNotificationsNextCursor,
} from './notifications.selectors';

@Injectable()
export class NotificationsEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store);
  private readonly api = inject(NotificationsApiService);
  private readonly badge = inject(NotificationBadgeService);
  private readonly router = inject(Router);

  readonly loadFeed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.loadFeed),
      switchMap(({ filter }) =>
        this.api.getFeed({ filter }).pipe(
          map((page) => NotificationsActions.loadFeedSuccess({ page })),
          catchError((error: unknown) =>
            of(
              NotificationsActions.loadFeedFailure({
                error: toApiErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // Switching the filter tab re-loads the feed for that filter.
  readonly filterChange$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.setFilter),
      map(({ filter }) => NotificationsActions.loadFeed({ filter })),
    ),
  );

  readonly loadMore$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.loadMore),
      withLatestFrom(
        this.store.select(selectNotificationFilter),
        this.store.select(selectNotificationsNextCursor),
      ),
      mergeMap(([, filter, cursor]) => {
        if (cursor === null) {
          return EMPTY;
        }
        return this.api.getFeed({ filter, cursor }).pipe(
          map((page) => NotificationsActions.loadMoreSuccess({ page })),
          catchError((error: unknown) =>
            of(
              NotificationsActions.loadMoreFailure({
                error: toApiErrorMessage(error),
              }),
            ),
          ),
        );
      }),
    ),
  );

  // Opening a notification: mark it read (only if unread) and deep-link.
  readonly openMarkRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.openNotification),
      withLatestFrom(this.store.select(selectNotificationItems)),
      mergeMap(([{ id }, items]) => {
        const target = items.find((item) => item.id === id);
        if (target !== undefined && !target.read) {
          return of(NotificationsActions.markRead({ id }));
        }
        return EMPTY;
      }),
    ),
  );

  readonly openNavigate$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NotificationsActions.openNotification),
        tap(({ deepLink }) => {
          if (deepLink) {
            void this.router.navigateByUrl(deepLink);
          }
        }),
      ),
    { dispatch: false },
  );

  readonly markRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markRead),
      mergeMap(({ id }) =>
        this.api.markRead(id).pipe(
          map(() => NotificationsActions.markReadSuccess({ id })),
          catchError((error: unknown) =>
            of(
              NotificationsActions.markReadFailure({
                id,
                error: toApiErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly markAllRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markAllRead),
      switchMap(() =>
        this.api.markAllRead().pipe(
          map(() => NotificationsActions.markAllReadSuccess()),
          catchError((error: unknown) =>
            of(
              NotificationsActions.markAllReadFailure({
                error: toApiErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  // Mark-all-read failed → re-fetch the current filter to resync with server.
  readonly markAllReadResync$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markAllReadFailure),
      withLatestFrom(this.store.select(selectNotificationFilter)),
      map(([, filter]) => NotificationsActions.loadFeed({ filter })),
    ),
  );

  // Keep the global header badge in sync with the feed's authoritative counts.
  readonly syncBadge$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          NotificationsActions.loadFeedSuccess,
          NotificationsActions.loadMoreSuccess,
        ),
        tap(({ page }) => this.badge.setUnreadCount(page.counts.unread)),
      ),
    { dispatch: false },
  );

  readonly syncBadgeMarkRead$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NotificationsActions.markReadSuccess),
        tap(() => this.badge.refresh()),
      ),
    { dispatch: false },
  );

  readonly syncBadgeMarkAll$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(NotificationsActions.markAllReadSuccess),
        tap(() => this.badge.setUnreadCount(0)),
      ),
    { dispatch: false },
  );
}
