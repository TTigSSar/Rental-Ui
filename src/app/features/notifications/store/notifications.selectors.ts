import { createFeatureSelector, createSelector } from '@ngrx/store';

import type {
  NotificationCounts,
  NotificationFilter,
  NotificationItem,
} from '../models/notification.model';
import { notificationsFeatureKey } from './notifications.reducer';
import type { NotificationsState } from './notifications.state';

export const selectNotificationsState =
  createFeatureSelector<NotificationsState>(notificationsFeatureKey);

export const selectNotificationItems = createSelector(
  selectNotificationsState,
  (state): NotificationItem[] => state.items,
);

export const selectNotificationCounts = createSelector(
  selectNotificationsState,
  (state): NotificationCounts => state.counts,
);

export const selectNotificationFilter = createSelector(
  selectNotificationsState,
  (state): NotificationFilter => state.filter,
);

export const selectNotificationsLoading = createSelector(
  selectNotificationsState,
  (state): boolean => state.loading,
);

export const selectNotificationsError = createSelector(
  selectNotificationsState,
  (state): string | null => state.error,
);

export const selectNotificationsLoadingMore = createSelector(
  selectNotificationsState,
  (state): boolean => state.loadingMore,
);

export const selectNotificationsMarkingAll = createSelector(
  selectNotificationsState,
  (state): boolean => state.markingAll,
);

export const selectNotificationsNextCursor = createSelector(
  selectNotificationsState,
  (state): string | null => state.nextCursor,
);

export const selectHasMoreNotifications = createSelector(
  selectNotificationsNextCursor,
  (cursor): boolean => cursor !== null,
);
