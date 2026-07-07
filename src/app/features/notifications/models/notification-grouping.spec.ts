import { groupNotifications } from './notification-grouping';
import type { NotificationItem } from './notification.model';

function makeItem(id: string, createdAt: string): NotificationItem {
  return {
    id,
    kind: 'message',
    category: 'message',
    title: id,
    body: '',
    meta: null,
    createdAt,
    read: false,
    urgent: false,
    actor: { name: 'X', avatarUrl: null, verified: false, system: false, systemIcon: null },
    toy: null,
    primaryAction: null,
    secondaryAction: null,
  };
}

describe('groupNotifications', () => {
  const now = new Date('2026-07-03T12:00:00Z');

  it('splits items into Today and Earlier and drops empty groups', () => {
    const groups = groupNotifications(
      [
        makeItem('today-1', '2026-07-03T08:00:00Z'),
        makeItem('earlier-1', '2026-07-01T08:00:00Z'),
      ],
      now,
    );
    expect(groups.map((g) => g.id)).toEqual(['today', 'earlier']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['today-1']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['earlier-1']);
  });

  it('returns only Today when nothing is older', () => {
    const groups = groupNotifications([makeItem('t', '2026-07-03T01:00:00Z')], now);
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe('today');
  });

  it('treats unparseable timestamps as earlier', () => {
    const groups = groupNotifications([makeItem('bad', 'not-a-date')], now);
    expect(groups[0].id).toBe('earlier');
  });
});
