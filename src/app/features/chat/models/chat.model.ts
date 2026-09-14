/**
 * Derived conversation status pill (computed server-side from the linked
 * booking's status + `Conversation.ClosedAt` — see `ChatTokens.StatusToken`
 * on the backend). Progression: requested -> approved -> active ->
 * return_due -> completed -> closed. `completed` is the booking-Completed,
 * chat-still-open state (awaiting party reviews); `closed` is the terminal,
 * read-only state set only once `ClosedAt` is non-null. `moderation` is a
 * distinct, non-progressing pill for a Moderation conversation (`kind ===
 * 'moderation'`) — see `ChatTokens.ModerationStatusToken` on the backend;
 * such a thread has no booking so none of the other pills ever apply to it.
 */
export type ChatStatus =
  | 'requested'
  | 'approved'
  | 'active'
  | 'return_due'
  | 'completed'
  | 'closed'
  | 'moderation';

export type ChatMessageType = 'text' | 'image' | 'system' | 'moderationNote';

export type ChatSystemKind = 'request' | 'approved' | 'handover' | 'return' | 'closed';

/**
 * Admin-action token for a `moderationNote` message (see
 * `ChatTokens.ModerationNoteKindToken` on the backend).
 */
export type ChatModerationNoteKind = 'reject' | 'warn' | 'suspend' | 'category' | 'info';

/**
 * `"booking" | "moderation"` — see `ChatTokens.ConversationKindToken` on the
 * backend. A `booking` conversation is the pre-existing, booking-scoped
 * thread (ADR-001); a `moderation` conversation is a moderator's direct
 * thread with a member, with no linked booking.
 */
export type ChatConversationKind = 'booking' | 'moderation';

/** Inbox row: one conversation preview in the conversations list. */
export interface ChatConversationPreview {
  id: string;
  kind: ChatConversationKind;
  /** Null for a Moderation conversation (`kind === 'moderation'`). */
  bookingId: string | null;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  /** Null for a Moderation conversation — there is no toy strip. */
  toyTitle: string | null;
  toyImageUrl: string | null;
  status: ChatStatus;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  /**
   * "text" | "image" | "system" | "moderationNote" token for the
   * conversation's last message (see `ChatTokens.MessageTypeToken` on the
   * backend), or null when there is no last message yet. An image message
   * has no text snippet, so the client should render a localized placeholder
   * (e.g. "Photo") when this is `'image'` and `lastMessageSnippet` is null —
   * the server never bakes in a literal display string.
   */
  lastMessageType: ChatMessageType | null;
  lastMessageIsMine: boolean;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string | null;
  type: ChatMessageType;
  systemKind: ChatSystemKind | null;
  /** Set only when `type === 'moderationNote'`; null otherwise. */
  noteKind: ChatModerationNoteKind | null;
  /** Subject of a moderation note (e.g. the listing title). Null otherwise. */
  noteSubject: string | null;
  /** Reason of a moderation note (e.g. the rejection reason label). Null otherwise. */
  noteReason: string | null;
  body: string | null;
  attachmentUrl: string | null;
  sentAt: string;
  isMine: boolean;
  seen: boolean;
}

export interface ChatConversationDetails {
  id: string;
  kind: ChatConversationKind;
  /** Null for a Moderation conversation (`kind === 'moderation'`). */
  bookingId: string | null;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  counterpartVerified: boolean;
  /** Null for a Moderation conversation — there is no toy strip. */
  toyTitle: string | null;
  toyImageUrl: string | null;
  status: ChatStatus;
  /** Null for a Moderation conversation. */
  bookingDates: string | null;
  /** Null for a Moderation conversation. */
  bookingPrice: number | null;
  isClosed: boolean;
  messages: ChatMessage[];
}

export interface SendChatMessageRequest {
  conversationId: string;
  content: string;
}

/**
 * Mirrors `ChatService.MaxContentLength` on the backend. The server rejects
 * a message whose `content` exceeds this length with ServiceError code
 * `chat.message_too_long` (HTTP 400).
 */
export const CHAT_MESSAGE_MAX_LENGTH = 4000;

/**
 * Params for `POST /api/chat/conversations/{id}/messages/image`
 * (multipart/form-data). Mirrors the backend `UploadChatImageRequest` fields
 * (`Image`, `Caption`) plus the route's conversation id; the caller builds a
 * `FormData` from these fields (see `ListingsApiService.uploadImages` for the
 * established multipart pattern in this codebase). Response shape is the
 * same `ChatMessage` returned by the text-send endpoint.
 */
export interface SendChatImageMessageRequest {
  conversationId: string;
  image: File;
  caption?: string;
}

/**
 * Mirrors `ChatService.MaxAttachmentBytes` on the backend (reused verbatim
 * from `ListingImagesOwnerService`). The server rejects a larger file with
 * ServiceError code `chat.attachment_too_large` (HTTP 400).
 */
export const CHAT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Mirrors `ChatService`'s allowed content-type whitelist for image
 * attachments. The server rejects any other type with ServiceError code
 * `chat.attachment_invalid_type` (HTTP 400).
 */
export const CHAT_ATTACHMENT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/**
 * Viewer-neutral message pushed over the chat SignalR hub (`messageReceived`).
 * The server sends the same payload to BOTH participants, so `isMine` / `seen`
 * are not present — they are derived locally against the current user.
 */
export interface ChatRealtimeMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName: string | null;
  type: ChatMessageType;
  systemKind: ChatSystemKind | null;
  /** Set only when `type === 'moderationNote'`; null otherwise. */
  noteKind: ChatModerationNoteKind | null;
  /** Subject of a moderation note (e.g. the listing title). Null otherwise. */
  noteSubject: string | null;
  /** Reason of a moderation note (e.g. the rejection reason label). Null otherwise. */
  noteReason: string | null;
  body: string | null;
  attachmentUrl: string | null;
  /** ISO UTC (ends in `Z`). */
  sentAt: string;
}

/** Payload of the hub `conversationRead` event, sent to both participants. */
export interface ChatRealtimeReadEvent {
  conversationId: string;
  readerUserId: string;
  /** ISO UTC (ends in `Z`). */
  readAtUtc: string;
}
