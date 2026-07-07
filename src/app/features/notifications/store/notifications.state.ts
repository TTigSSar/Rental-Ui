import type {
  NotificationCounts,
  NotificationFilter,
  NotificationItem,
} from '../models/notification.model';

export interface NotificationsState {
  readonly items: NotificationItem[];
  readonly counts: NotificationCounts;
  readonly filter: NotificationFilter;
  readonly nextCursor: string | null;
  /** First-page / filter-switch load. */
  readonly loading: boolean;
  readonly error: string | null;
  /** Subsequent "load more" page fetch. */
  readonly loadingMore: boolean;
  readonly markingAll: boolean;
}

export const initialNotificationsState: NotificationsState = {
  items: [],
  counts: { all: 0, unread: 0, action: 0 },
  filter: 'all',
  nextCursor: null,
  loading: false,
  error: null,
  loadingMore: false,
  markingAll: false,
};
