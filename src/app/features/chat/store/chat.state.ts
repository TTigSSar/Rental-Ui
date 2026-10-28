import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ShareMeetingPointRequest,
} from '../models/chat.model';

/**
 * The image currently being uploaded (or the one whose upload just failed),
 * rendered as an optimistic bubble at the end of the thread. `previewUrl` is a
 * local object URL of the compressed file — revoked once the server message
 * lands.
 */
export interface PendingChatImage {
  readonly conversationId: string;
  readonly previewUrl: string;
  readonly caption: string | null;
  readonly failed: boolean;
}

/**
 * The meeting-point share in flight (or the one that just failed), ADR-053. A home
 * share renders as an optimistic "sending / failed" bubble in the thread; an
 * "other place" share is owned by the map picker, which reads the same state.
 * `errorCode` is the raw API code (e.g. `chat.conversation_closed`) so the page can
 * react to a chat that became read-only; `error` is the already-mapped display string.
 */
export interface PendingMeetingPoint {
  readonly conversationId: string;
  readonly request: ShareMeetingPointRequest;
  readonly status: 'sending' | 'failed';
  readonly error: string | null;
  readonly errorCode: string | null;
}

export interface ChatState {
  conversations: ChatConversationPreview[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  activeConversation: ChatConversationDetails | null;
  activeConversationLoading: boolean;
  activeConversationError: string | null;
  sendingMessage: boolean;
  sendingMessageError: string | null;
  pendingImage: PendingChatImage | null;
  sendingImageError: string | null;
  pendingMeetingPoint: PendingMeetingPoint | null;
  /** In flight for `openConversationFromBooking` (the "Message {owner}" CTA). */
  openingConversationFromBooking: boolean;
}

export const initialChatState: ChatState = {
  conversations: [],
  conversationsLoading: false,
  conversationsError: null,
  activeConversation: null,
  activeConversationLoading: false,
  activeConversationError: null,
  sendingMessage: false,
  sendingMessageError: null,
  pendingImage: null,
  sendingImageError: null,
  pendingMeetingPoint: null,
  openingConversationFromBooking: false,
};
