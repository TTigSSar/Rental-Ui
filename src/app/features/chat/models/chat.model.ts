export type ChatStatus =
  | 'requested'
  | 'approved'
  | 'active'
  | 'return_due'
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
