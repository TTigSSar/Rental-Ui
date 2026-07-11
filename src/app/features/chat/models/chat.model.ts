/**
 * Derived conversation status pill (computed server-side from the linked
 * booking's status + `Conversation.ClosedAt` — see `ChatTokens.StatusToken`
 * on the backend). Progression: requested -> approved -> active ->
 * return_due -> completed -> closed. `completed` is the booking-Completed,
 * chat-still-open state (awaiting party reviews); `closed` is the terminal,
 * read-only state set only once `ClosedAt` is non-null.
 */
export type ChatStatus =
  | 'requested'
  | 'approved'
  | 'active'
  | 'return_due'
  | 'completed'
  | 'closed';

export type ChatMessageType = 'text' | 'image' | 'system';

export type ChatSystemKind =
  | 'request'
  | 'approved'
  | 'handover'
  | 'return'
  | 'closed';

/** Inbox row: one conversation preview in the conversations list. */
export interface ChatConversationPreview {
  id: string;
  bookingId: string;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  toyTitle: string;
  toyImageUrl: string | null;
  status: ChatStatus;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
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
  body: string | null;
  attachmentUrl: string | null;
  sentAt: string;
  isMine: boolean;
  seen: boolean;
}

export interface ChatConversationDetails {
  id: string;
  bookingId: string;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
  counterpartVerified: boolean;
  toyTitle: string;
  toyImageUrl: string | null;
  status: ChatStatus;
  bookingDates: string;
  bookingPrice: number;
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
