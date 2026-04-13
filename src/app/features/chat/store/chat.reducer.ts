import { createReducer, on } from '@ngrx/store';

import * as ChatActions from './chat.actions';
import { initialChatState, type ChatState } from './chat.state';

export const chatFeatureKey = 'chat' as const;

export const chatReducer = createReducer(
  initialChatState,
  on(
    ChatActions.loadConversations,
    (state): ChatState => ({
      ...state,
      conversationsLoading: true,
      conversationsError: null,
    }),
  ),
  on(
    ChatActions.loadConversationsSuccess,
    (state, { conversations }): ChatState => ({
      ...state,
      conversations: [...conversations],
      conversationsLoading: false,
      conversationsError: null,
    }),
  ),
  on(
    ChatActions.loadConversationsFailure,
    (state, { error }): ChatState => ({
      ...state,
      conversationsLoading: false,
      conversationsError: error,
    }),
  ),
  on(
    ChatActions.loadConversationDetails,
    (state): ChatState => ({
      ...state,
      activeConversationLoading: true,
      activeConversationError: null,
      sendingMessageError: null,
    }),
  ),
  on(
    ChatActions.loadConversationDetailsSuccess,
    (state, { conversation }): ChatState => ({
      ...state,
      activeConversation: conversation,
      activeConversationLoading: false,
      activeConversationError: null,
    }),
  ),
  on(
    ChatActions.loadConversationDetailsFailure,
    (state, { error }): ChatState => ({
      ...state,
      activeConversationLoading: false,
      activeConversationError: error,
    }),
  ),
  on(
    ChatActions.sendMessage,
    (state): ChatState => ({
      ...state,
      sendingMessage: true,
      sendingMessageError: null,
    }),
  ),
  on(
    ChatActions.sendMessageSuccess,
    (state, { message }): ChatState => {
      if (
        state.activeConversation === null ||
        state.activeConversation.id !== message.conversationId
      ) {
        return {
          ...state,
          sendingMessage: false,
          sendingMessageError: null,
        };
      }

      return {
        ...state,
        sendingMessage: false,
        sendingMessageError: null,
        activeConversation: {
          ...state.activeConversation,
          messages: [...state.activeConversation.messages, message],
        },
      };
    },
  ),
  on(
    ChatActions.sendMessageFailure,
    (state, { error }): ChatState => ({
      ...state,
      sendingMessage: false,
      sendingMessageError: error,
    }),
  ),
);
