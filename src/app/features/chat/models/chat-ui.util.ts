import type { BadgeTone } from '../../../shared/ui/badge/badge.component';
import type { ChatConversationPreview, ChatStatus, ChatSystemKind } from './chat.model';

/** Maps a conversation status to a `shared/ui` badge tone. */
export function mapChatStatusTone(status: ChatStatus): BadgeTone {
  switch (status) {
    case 'requested':
      return 'pending';
    case 'approved':
      return 'approved';
    case 'active':
      return 'booked';
    case 'return_due':
      return 'pending';
    case 'completed':
      return 'approved';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Maps a conversation status to its ngx-translate label key. */
export function mapChatStatusLabelKey(status: ChatStatus): string {
  switch (status) {
    case 'requested':
      return 'chat.status.requested';
    case 'approved':
      return 'chat.status.approved';
    case 'active':
      return 'chat.status.active';
    case 'return_due':
      return 'chat.status.returnDue';
    case 'completed':
      return 'chat.status.completed';
    case 'closed':
      return 'chat.status.closed';
    default:
      return 'chat.status.closed';
  }
}

export interface ChatSystemMeta {
  readonly icon: string;
  readonly labelKey: string;
}

/** Maps a system message kind to a primeicon + translated label. */
export function mapChatSystemMeta(kind: ChatSystemKind | null): ChatSystemMeta {
  switch (kind) {
    case 'request':
      return { icon: 'pi pi-inbox', labelKey: 'chat.system.request' };
    case 'approved':
      return { icon: 'pi pi-check-circle', labelKey: 'chat.system.approved' };
    case 'handover':
      return {
        icon: 'pi pi-arrow-right-arrow-left',
        labelKey: 'chat.system.handover',
      };
    case 'return':
      return { icon: 'pi pi-replay', labelKey: 'chat.system.return' };
    case 'closed':
      return { icon: 'pi pi-lock', labelKey: 'chat.system.closed' };
    default:
      return { icon: 'pi pi-info-circle', labelKey: 'chat.system.default' };
  }
}

/**
 * A day-divider label for the message thread. `today` / `yesterday` are rendered
 * via ngx-translate keys; `date` carries an already-formatted, locale-aware
 * string (short weekday within the last week, else day + month).
 */
export type ChatDayLabel =
  | { readonly kind: 'today' }
  | { readonly kind: 'yesterday' }
  | { readonly kind: 'date'; readonly text: string };

/** Start-of-day timestamp for `date` in the local timezone. */
function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Stable local calendar-day key (`YYYY-MM-DD`) for grouping messages by day.
 * Uses local date parts so a message near midnight lands on the viewer's day.
 */
export function chatDayKey(sentAt: string): string {
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) {
    return sentAt;
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Divider label for a message's day relative to `now` (local time):
 * Today / Yesterday / short weekday (last week) / day-month (older).
 */
export function chatDayLabel(sentAt: string, now: Date = new Date()): ChatDayLabel {
  const then = new Date(sentAt);
  if (Number.isNaN(then.getTime())) {
    return { kind: 'date', text: sentAt };
  }

  const msPerDay = 86_400_000;
  const diffDays = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / msPerDay);

  if (diffDays <= 0) {
    return { kind: 'today' };
  }
  if (diffDays === 1) {
    return { kind: 'yesterday' };
  }
  if (diffDays < 7) {
    return { kind: 'date', text: then.toLocaleDateString(undefined, { weekday: 'short' }) };
  }
  return {
    kind: 'date',
    text: then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
  };
}

/**
 * Case-insensitive client-side filter of already-loaded conversations by
 * counterpart name or toy title. An empty/blank query returns the list as-is.
 */
export function filterConversations(
  conversations: readonly ChatConversationPreview[],
  query: string,
): ChatConversationPreview[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return [...conversations];
  }
  return conversations.filter(
    (conversation) =>
      conversation.counterpartName.toLowerCase().includes(normalized) ||
      conversation.toyTitle.toLowerCase().includes(normalized),
  );
}
