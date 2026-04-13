export interface ChatConversationPreview {
  id: string;
  title: string;
  lastMessageSnippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  sentAt: string;
}

export interface ChatConversationDetails {
  id: string;
  title: string;
  participantName: string | null;
  listingTitle: string | null;
  messages: ChatMessage[];
}

export interface SendChatMessageRequest {
  content: string;
}
