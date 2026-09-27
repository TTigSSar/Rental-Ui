import type { AdminMarketplaceRole, AdminUserStatus } from './admin-user.model';

export type { AdminMarketplaceRole, AdminUserStatus };

/**
 * Admin console: the Messages screen (moderation-only conversations — see ADR-016 §4 /
 * `Conversation.Kind == Moderation`). Mirrors `AdminMessageThreadResponse` /
 * `AdminMessageThreadQueueResponse` / `AdminMessageThreadFilter` (rental-api
 * `Application/DTOs/AdminMessageThread*.cs`). `AdminMarketplaceRole`/`AdminUserStatus` are
 * re-exported from `admin-user.model.ts` rather than redefined here — same "core type lives in
 * its natural feature, admin imports it" pattern `admin-report.model.ts` uses for
 * `ReportSeverity`/`ReportStatus`. Everything else on the Messages screen (send/read/detail) is
 * the existing `features/chat/models/chat.model.ts` surface, reused unchanged.
 */

/**
 * One row of the admin Messages thread queue — also the shape returned by
 * `POST /api/admin/messages/threads` (get-or-create). `memberStatus`/`memberMarketplaceRole` are
 * derived exactly as `AdminUser.status`/`marketplaceRole` are (from `isIdConfirmed`/`isBlocked`
 * and listing/rental counts) — nothing new persisted. Mirrors `AdminMessageThreadResponse`.
 */
export interface AdminMessageThread {
  conversationId: string;

  memberId: string;
  memberFirstName: string;
  memberLastName: string;
  memberAvatarUrl: string | null;

  /** Derived: isBlocked => Suspended; else isIdConfirmed => Active; else Pending. */
  memberStatus: AdminUserStatus;
  memberIsIdConfirmed: boolean;

  /**
   * Derived from activity: has listings => Owner, has bookings-as-renter => Renter, both =>
   * Both, neither => Renter.
   */
  memberMarketplaceRole: AdminMarketplaceRole;

  /** Count of Open reports filed against this member. */
  memberOpenFlagCount: number;

  unreadCount: number;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;

  /**
   * `"text" | "image" | "system" | "moderationNote"` token for the thread's last message (see
   * `ChatTokens.MessageTypeToken`) — same convention as `ChatConversation.lastMessageType`. Null
   * when the thread has no messages yet.
   */
  lastMessageType: string | null;

  /**
   * The moderation note's subject when `lastMessageType` is `"moderationNote"`; null otherwise.
   * `lastMessageSnippet` is the raw note body in that case — this lets the client render
   * "Note: {subject}" instead of bare body text.
   */
  lastMessageNoteSubject: string | null;

  /** True when the last message in this thread was sent by the member — drives the "Needs reply" filter. */
  needsReply: boolean;

  createdAt: string;
}

/**
 * Search-filtered (not pill-filtered) totals for the design's three filter pills — same
 * convention as `AdminReportQueueCounts`/`AdminUserQueueSummary`: the header numbers stay stable
 * as the admin switches the All/Unread/NeedsReply pill with the same search term applied. Also
 * backs the admin shell's nav unread badge (`unread`), which otherwise only sees one loaded page.
 * Mirrors `AdminMessageThreadCounts`.
 */
export interface AdminMessageThreadCounts {
  all: number;
  unread: number;
  needsReply: number;
}

/** Mirrors `AdminMessageThreadQueueResponse`. */
export interface AdminMessageThreadQueue {
  items: AdminMessageThread[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  counts: AdminMessageThreadCounts;
}

/**
 * Backend binds this to a loose string ("all" | "unread" | "needsReply", case-insensitive) —
 * see `AdminMessageThreadFilter.Filter`. Unrecognised/omitted values default to "all"
 * server-side, same convention as `AdminUserQueueFilter.Status`/`AdminReportQueueFilter.Status`.
 */
export type AdminMessageThreadFilter = 'all' | 'unread' | 'needsReply';

/** Search matches the member's name/email. */
export interface AdminMessageThreadQueueParams {
  filter?: AdminMessageThreadFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Body for `POST /api/admin/messages/threads`: get-or-create the Moderation thread for this member. */
export interface OpenAdminMessageThreadRequest {
  userId: string;
}
