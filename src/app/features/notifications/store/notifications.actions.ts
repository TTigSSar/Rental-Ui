import { createAction, props } from '@ngrx/store';

import type {
  NotificationFeedPage,
  NotificationFilter,
} from '../models/notification.model';

// ── Feed (first page / filter switch) ────────────────────────────────────────
export const loadFeed = createAction(
  '[Notifications] Load Feed',
  props<{ filter: NotificationFilter }>(),
);

export const loadFeedSuccess = createAction(
  '[Notifications] Load Feed Success',
  props<{ page: NotificationFeedPage }>(),
);

export const loadFeedFailure = createAction(
  '[Notifications] Load Feed Failure',
  props<{ error: string }>(),
);

// ── Pagination ───────────────────────────────────────────────────────────────
export const loadMore = createAction('[Notifications] Load More');

export const loadMoreSuccess = createAction(
  '[Notifications] Load More Success',
  props<{ page: NotificationFeedPage }>(),
);

export const loadMoreFailure = createAction(
  '[Notifications] Load More Failure',
  props<{ error: string }>(),
);

// ── Filter ───────────────────────────────────────────────────────────────────
export const setFilter = createAction(
  '[Notifications] Set Filter',
  props<{ filter: NotificationFilter }>(),
);

// ── Open (mark read optimistically, then deep-link) ──────────────────────────
export const openNotification = createAction(
  '[Notifications] Open Notification',
  props<{ id: string; deepLink: string | null }>(),
);

// ── Mark one read (also fired by an action button) ───────────────────────────
export const markRead = createAction(
  '[Notifications] Mark Read',
  props<{ id: string }>(),
);

export const markReadSuccess = createAction(
  '[Notifications] Mark Read Success',
  props<{ id: string }>(),
);

export const markReadFailure = createAction(
  '[Notifications] Mark Read Failure',
  props<{ id: string; error: string }>(),
);

// ── Mark all read ────────────────────────────────────────────────────────────
export const markAllRead = createAction('[Notifications] Mark All Read');

export const markAllReadSuccess = createAction(
  '[Notifications] Mark All Read Success',
);

export const markAllReadFailure = createAction(
  '[Notifications] Mark All Read Failure',
  props<{ error: string }>(),
);
