import { createFeatureSelector, createSelector } from '@ngrx/store';

import type {
  ChatConversationDetails,
  ChatConversationPreview,
} from '../models/chat.model';
import { chatFeatureKey } from './chat.reducer';
import type { ChatState } from './chat.state';

export const selectChatState = createFeatureSelector<ChatState>(chatFeatureKey);

export const selectConversations = createSelector(
  selectChatState,
  (state: ChatState): ChatConversationPreview[] => state.conversations,
);

export const selectConversationsLoading = createSelector(
  selectChatState,
  (state: ChatState): boolean => state.conversationsLoading,
);

export const selectConversationsError = createSelector(
  selectChatState,
  (state: ChatState): string | null => state.conversationsError,
);

export const selectActiveConversation = createSelector(
  selectChatState,
  (state: ChatState): ChatConversationDetails | null => state.activeConversation,
);

export const selectActiveConversationLoading = createSelector(
  selectChatState,
  (state: ChatState): boolean => state.activeConversationLoading,
);

export const selectActiveConversationError = createSelector(
  selectChatState,
  (state: ChatState): string | null => state.activeConversationError,
);

export const selectSendingMessage = createSelector(
  selectChatState,
  (state: ChatState): boolean => state.sendingMessage,
);

export const selectSendingMessageError = createSelector(
  selectChatState,
  (state: ChatState): string | null => state.sendingMessageError,
);
