import type {
  NotificationFeedPage,
  NotificationItem,
} from '../models/notification.model';
import * as NotificationsActions from './notifications.actions';
import { notificationsReducer } from './notifications.reducer';
import { initialNotificationsState, type NotificationsState } from './notifications.state';

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    kind: 'approved',
    category: 'booking',
    title: 'Approved',
    body: 'body',
    meta: null,
    createdAt: '2026-07-03T09:00:00Z',
    read: false,
    urgent: false,
    actor: { name: 'Anna', avatarUrl: null, verified: false, system: false, systemIcon: null },
    toy: null,
    primaryAction: null,
    secondaryAction: null,
    ...overrides,
  };
}

function makePage(overrides: Partial<NotificationFeedPage> = {}): NotificationFeedPage {
  return {
    items: [makeItem()],
    nextCursor: null,
    counts: { all: 1, unread: 1, action: 0 },
    ...overrides,
  };
}

function stateWith(overrides: Partial<NotificationsState>): NotificationsState {
  return { ...initialNotificationsState, ...overrides };
}

describe('notificationsReducer', () => {
  it('replaces items and counts on loadFeedSuccess', () => {
    const next = notificationsReducer(
      stateWith({ loading: true }),
      NotificationsActions.loadFeedSuccess({ page: makePage() }),
    );
    expect(next.items).toHaveLength(1);
    expect(next.counts.unread).toBe(1);
    expect(next.loading).toBe(false);
  });

  it('appends and de-dupes pages on loadMoreSuccess', () => {
    const start = stateWith({ items: [makeItem({ id: 'a' })], nextCursor: 'c' });
    const next = notificationsReducer(
      start,
      NotificationsActions.loadMoreSuccess({
        page: makePage({ items: [makeItem({ id: 'a' }), makeItem({ id: 'b' })] }),
      }),
    );
    expect(next.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  describe('optimistic mark read', () => {
    it('flips the item and decrements unread only when it was unread', () => {
      const start = stateWith({
        items: [makeItem({ id: 'n1', read: false })],
        counts: { all: 1, unread: 1, action: 0 },
      });
      const next = notificationsReducer(
        start,
        NotificationsActions.markRead({ id: 'n1' }),
      );
      expect(next.items[0].read).toBe(true);
      expect(next.counts.unread).toBe(0);
    });

    it('is a no-op when the item is already read', () => {
      const start = stateWith({
        items: [makeItem({ id: 'n1', read: true })],
        counts: { all: 1, unread: 0, action: 0 },
      });
      const next = notificationsReducer(
        start,
        NotificationsActions.markRead({ id: 'n1' }),
      );
      expect(next).toBe(start);
    });

    it('rolls back the flip on failure', () => {
      const start = stateWith({
        items: [makeItem({ id: 'n1', read: true })],
        counts: { all: 1, unread: 0, action: 0 },
      });
      const next = notificationsReducer(
        start,
        NotificationsActions.markReadFailure({ id: 'n1', error: 'boom' }),
      );
      expect(next.items[0].read).toBe(false);
      expect(next.counts.unread).toBe(1);
    });
  });

  it('marks every item read and zeroes unread on markAllRead', () => {
    const start = stateWith({
      items: [makeItem({ id: 'a', read: false }), makeItem({ id: 'b', read: true })],
      counts: { all: 2, unread: 1, action: 0 },
    });
    const next = notificationsReducer(start, NotificationsActions.markAllRead());
    expect(next.items.every((i) => i.read)).toBe(true);
    expect(next.counts.unread).toBe(0);
    expect(next.markingAll).toBe(true);
  });

  it('updates the active filter immediately on setFilter', () => {
    const next = notificationsReducer(
      initialNotificationsState,
      NotificationsActions.setFilter({ filter: 'unread' }),
    );
    expect(next.filter).toBe('unread');
  });
});
