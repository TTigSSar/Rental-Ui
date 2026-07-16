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

/**
 * Maps a conversation status to the primeicon shown inside its status pill
 * (design: clock / check / calendar / lock — one glyph per status family).
 */
export function mapChatStatusIcon(status: ChatStatus): string {
  switch (status) {
    case 'requested':
    case 'return_due':
      return 'pi pi-clock';
    case 'approved':
    case 'completed':
      return 'pi pi-check';
    case 'active':
      return 'pi pi-calendar';
    case 'closed':
      return 'pi pi-lock';
    default:
      return 'pi pi-lock';
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

/**
 * Color family of a system line's icon chip. Every system line shares the same
 * white chrome; only the icon chip is tinted, and this picks the tint.
 */
export type ChatSystemTone = 'primary' | 'success' | 'warn' | 'neutral';

export interface ChatSystemMeta {
  readonly icon: string;
  readonly labelKey: string;
  readonly tone: ChatSystemTone;
}

/** Maps a system message kind to a primeicon + tint + translated label. */
export function mapChatSystemMeta(kind: ChatSystemKind | null): ChatSystemMeta {
  switch (kind) {
    case 'request':
      return { icon: 'pi pi-calendar', labelKey: 'chat.system.request', tone: 'primary' };
    case 'approved':
      return { icon: 'pi pi-check', labelKey: 'chat.system.approved', tone: 'success' };
    case 'handover':
      return { icon: 'pi pi-shield', labelKey: 'chat.system.handover', tone: 'primary' };
    case 'return':
      return { icon: 'pi pi-clock', labelKey: 'chat.system.return', tone: 'warn' };
    case 'closed':
      return { icon: 'pi pi-lock', labelKey: 'chat.system.closed', tone: 'neutral' };
    default:
      return { icon: 'pi pi-info-circle', labelKey: 'chat.system.default', tone: 'neutral' };
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
