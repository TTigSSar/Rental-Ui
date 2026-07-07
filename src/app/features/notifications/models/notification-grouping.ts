import type { NotificationItem } from './notification.model';

export type NotificationGroupId = 'today' | 'earlier';

export interface NotificationGroup {
  readonly id: NotificationGroupId;
  readonly labelKey: string;
  readonly items: NotificationItem[];
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Split a feed page into Today / Earlier sections based on `createdAt`, dropping
 * empty groups. Order within each group is preserved (the backend returns the
 * feed newest-first). `now` is injectable for deterministic tests.
 */
export function groupNotifications(
  items: NotificationItem[],
  now: Date = new Date(),
): NotificationGroup[] {
  const today: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  for (const item of items) {
    const created = new Date(item.createdAt);
    if (!Number.isNaN(created.getTime()) && isSameCalendarDay(created, now)) {
      today.push(item);
    } else {
      earlier.push(item);
    }
  }

  const groups: NotificationGroup[] = [];
  if (today.length > 0) {
    groups.push({ id: 'today', labelKey: 'notifications.group.today', items: today });
  }
  if (earlier.length > 0) {
    groups.push({
      id: 'earlier',
      labelKey: 'notifications.group.earlier',
      items: earlier,
    });
  }
  return groups;
}
