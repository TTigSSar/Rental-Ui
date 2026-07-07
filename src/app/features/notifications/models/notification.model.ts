/**
 * Notification domain model for ToyRent.
 *
 * Mirrors the approved "Avatar" notification design (notifications-data.jsx):
 * two audiences (renter / owner) share ten event `kind`s, each of which drives
 * an icon + colour + label. All display copy (`title`, `body`, `meta`,
 * action labels) is produced by the backend, which is the source of truth and
 * localises server-side — the same convention the chat feature uses for its
 * conversation titles/snippets. The client only owns the per-kind visual
 * mapping (see notification-kind.ts) and the static chrome (filter tabs, empty
 * / loading / error states).
 */

/** The ten event kinds. Each drives icon + colour + label on the card. */
export type NotificationKind =
  | 'request'
  | 'approved'
  | 'declined'
  | 'listing_live'
  | 'listing_changes'
  | 'pickup'
  | 'confirm'
  | 'return'
  | 'review'
  | 'message';

/** Coarse category used for grouping / preferences. */
export type NotificationCategory =
  | 'booking'
  | 'listing'
  | 'reminder'
  | 'review'
  | 'message';

/** Feed filter tabs. `action` == urgent items that need the user to act. */
export type NotificationFilter = 'all' | 'unread' | 'action';

export const NOTIFICATION_FILTERS: readonly NotificationFilter[] = [
  'all',
  'unread',
  'action',
] as const;

/**
 * Who triggered the notification. A regular user renders a photo avatar; a
 * platform sender (admin / moderator / system) renders an icon chip instead
 * (`system: true`, with `systemIcon` naming a PrimeIcon).
 */
export interface NotificationActor {
  readonly name: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly system: boolean;
  /** PrimeIcon name (without the `pi-` prefix) used for system senders. */
  readonly systemIcon: string | null;
}

/** The toy the notification is about (shown as a thumbnail). */
export interface NotificationToy {
  readonly imageUrl: string | null;
  readonly title: string;
}

/**
 * A deep-link action. `label` is backend-provided display text; `deepLink` is
 * an in-app router URL (e.g. `/bookings/4821`, `/chat/abc`, `/my-listings/x/edit`)
 * that routes into a flow that already exists in the app.
 */
export interface NotificationAction {
  readonly label: string;
  readonly deepLink: string;
}

export interface NotificationItem {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly category: NotificationCategory;
  readonly title: string;
  readonly body: string;
  /** Secondary context line, e.g. "4 days · ֏6,000" or "Booking #4821". */
  readonly meta: string | null;
  /** ISO-8601 timestamp; drives Today / Earlier grouping and relative time. */
  readonly createdAt: string;
  readonly read: boolean;
  /** Needs the user to act → "Action needed" pill + the Action filter. */
  readonly urgent: boolean;
  readonly actor: NotificationActor;
  readonly toy: NotificationToy | null;
  readonly primaryAction: NotificationAction | null;
  readonly secondaryAction: NotificationAction | null;
}

/**
 * Server-computed feed counts backing the filter tab badges. Kept authoritative
 * (aggregated backend-side) rather than derived from the loaded page, which is
 * only a slice of the full feed.
 */
export interface NotificationCounts {
  readonly all: number;
  readonly unread: number;
  readonly action: number;
}

/** One page of the paginated feed. `nextCursor` is null on the last page. */
export interface NotificationFeedPage {
  readonly items: NotificationItem[];
  readonly nextCursor: string | null;
  readonly counts: NotificationCounts;
}

export interface UnreadCountResponse {
  readonly unreadCount: number;
}
