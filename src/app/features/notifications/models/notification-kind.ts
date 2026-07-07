import type { NotificationKind } from './notification.model';

/**
 * Per-kind visual mapping — the one piece of notification presentation the
 * client owns. Colours mirror the design tokens (system.jsx TOKENS.A) and the
 * "one colour does one job" rule: success = good, danger = bad, warn =
 * time-sensitive, primary = your action, amber = review, navy = message.
 *
 * `icon` is a PrimeIcon name without the `pi-` prefix. `labelKey` is an i18n
 * key under `notifications.kind.*` so the pill label localises client-side
 * (it is a fixed taxonomy, unlike the backend-provided title/body copy).
 */
export interface NotificationKindMeta {
  readonly icon: string;
  readonly color: string;
  /** Soft background tint for the label pill / unread wash. */
  readonly soft: string;
  readonly labelKey: string;
}

export const NOTIFICATION_KIND_META: Record<NotificationKind, NotificationKindMeta> = {
  request: {
    icon: 'calendar-plus',
    color: '#ff6008',
    soft: '#ffeedc',
    labelKey: 'notifications.kind.request',
  },
  approved: {
    icon: 'check-circle',
    color: '#0e8a5f',
    soft: '#e6f4ee',
    labelKey: 'notifications.kind.approved',
  },
  declined: {
    icon: 'times-circle',
    color: '#d9342b',
    soft: '#fdecea',
    labelKey: 'notifications.kind.declined',
  },
  listing_live: {
    icon: 'verified',
    color: '#0e8a5f',
    soft: '#e6f4ee',
    labelKey: 'notifications.kind.listingLive',
  },
  listing_changes: {
    icon: 'flag',
    color: '#d9342b',
    soft: '#fdecea',
    labelKey: 'notifications.kind.listingChanges',
  },
  pickup: {
    icon: 'truck',
    color: '#d97706',
    soft: '#fff1dc',
    labelKey: 'notifications.kind.pickup',
  },
  confirm: {
    icon: 'shield',
    color: '#ff6008',
    soft: '#ffeedc',
    labelKey: 'notifications.kind.confirm',
  },
  return: {
    icon: 'clock',
    color: '#d97706',
    soft: '#fff1dc',
    labelKey: 'notifications.kind.return',
  },
  review: {
    icon: 'star',
    color: '#e39a00',
    soft: '#fcf1d8',
    labelKey: 'notifications.kind.review',
  },
  message: {
    icon: 'comment',
    color: '#4a5fe3',
    soft: '#e8eaff',
    labelKey: 'notifications.kind.message',
  },
};

export function notificationKindMeta(kind: NotificationKind): NotificationKindMeta {
  return NOTIFICATION_KIND_META[kind];
}
