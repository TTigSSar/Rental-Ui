import type {
  ChatConversationDetails,
  ChatConversationPreview,
} from '../models/chat.model';

export interface ChatState {
  conversations: ChatConversationPreview[];
  conversationsLoading: boolean;
  conversationsError: string | null;
  activeConversation: ChatConversationDetails | null;
  activeConversationLoading: boolean;
  activeConversationError: string | null;
  sendingMessage: boolean;
  sendingMessageError: string | null;
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
};
