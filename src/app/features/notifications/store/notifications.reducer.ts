import { createReducer, on } from '@ngrx/store';

import type { NotificationItem } from '../models/notification.model';
import * as NotificationsActions from './notifications.actions';
import {
  initialNotificationsState,
  type NotificationsState,
} from './notifications.state';

export const notificationsFeatureKey = 'notifications' as const;

function markItemRead(
  items: NotificationItem[],
  id: string,
  read: boolean,
): NotificationItem[] {
  return items.map((item) =>
    item.id === id ? { ...item, read } : item,
  );
}

export const notificationsReducer = createReducer(
  initialNotificationsState,

  // Reflect the selected tab immediately; the effect then reloads for it.
  on(
    NotificationsActions.setFilter,
    (state, { filter }): NotificationsState => ({
      ...state,
      filter,
    }),
  ),

  on(
    NotificationsActions.loadFeed,
    (state, { filter }): NotificationsState => ({
      ...state,
      filter,
      loading: true,
      error: null,
    }),
  ),
  on(
    NotificationsActions.loadFeedSuccess,
    (state, { page }): NotificationsState => ({
      ...state,
      items: [...page.items],
      counts: page.counts,
      nextCursor: page.nextCursor,
      loading: false,
      error: null,
    }),
  ),
  on(
    NotificationsActions.loadFeedFailure,
    (state, { error }): NotificationsState => ({
      ...state,
      loading: false,
      error,
    }),
  ),

  on(
    NotificationsActions.loadMore,
    (state): NotificationsState => ({
      ...state,
      loadingMore: true,
      error: null,
    }),
  ),
  on(
    NotificationsActions.loadMoreSuccess,
    (state, { page }): NotificationsState => ({
      ...state,
      // Append, de-duping by id in case the cursor overlaps.
      items: [
        ...state.items,
        ...page.items.filter(
          (incoming) => !state.items.some((existing) => existing.id === incoming.id),
        ),
      ],
      counts: page.counts,
      nextCursor: page.nextCursor,
      loadingMore: false,
    }),
  ),
  on(
    NotificationsActions.loadMoreFailure,
    (state, { error }): NotificationsState => ({
      ...state,
      loadingMore: false,
      error,
    }),
  ),

  // Optimistic single mark-read: flip the item and decrement unread only when
  // it was actually unread (guards against double dispatch).
  on(
    NotificationsActions.markRead,
    (state, { id }): NotificationsState => {
      const target = state.items.find((item) => item.id === id);
      if (target === undefined || target.read) {
        return state;
      }
      return {
        ...state,
        items: markItemRead(state.items, id, true),
        counts: {
          ...state.counts,
          unread: Math.max(0, state.counts.unread - 1),
        },
      };
    },
  ),
  on(
    NotificationsActions.markReadSuccess,
    (state): NotificationsState => state,
  ),
  // Rollback the optimistic flip on failure.
  on(
    NotificationsActions.markReadFailure,
    (state, { id }): NotificationsState => {
      const target = state.items.find((item) => item.id === id);
      if (target === undefined || !target.read) {
        return state;
      }
      return {
        ...state,
        items: markItemRead(state.items, id, false),
        counts: {
          ...state.counts,
          unread: state.counts.unread + 1,
        },
      };
    },
  ),

  // Optimistic mark-all-read: flip every loaded item and zero the unread count.
  on(
    NotificationsActions.markAllRead,
    (state): NotificationsState => ({
      ...state,
      markingAll: true,
      items: state.items.map((item) =>
        item.read ? item : { ...item, read: true },
      ),
      counts: { ...state.counts, unread: 0 },
    }),
  ),
  on(
    NotificationsActions.markAllReadSuccess,
    (state): NotificationsState => ({
      ...state,
      markingAll: false,
    }),
  ),
  // On failure the effect re-fetches the feed to resync with server truth;
  // here we only clear the in-flight flag.
  on(
    NotificationsActions.markAllReadFailure,
    (state): NotificationsState => ({
      ...state,
      markingAll: false,
    }),
  ),
);
