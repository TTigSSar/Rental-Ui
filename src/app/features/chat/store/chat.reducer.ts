import { createReducer, on } from '@ngrx/store';

import type {
  ChatConversationPreview,
  ChatMessage,
} from '../models/chat.model';
import * as ChatActions from './chat.actions';
import { initialChatState, type ChatState } from './chat.state';

export const chatFeatureKey = 'chat' as const;

/**
 * Merge a freshly received message into the inbox row for its conversation:
 * refresh the last-message preview and bump the unread counter when it is an
 * incoming message the user is not currently looking at. Rows that do not exist
 * yet (e.g. a brand-new conversation) are left untouched — the next
 * `loadConversations` reconciles them.
 */
function applyMessageToInbox(
  conversations: ChatConversationPreview[],
  message: ChatMessage,
  isOpenConversation: boolean,
): ChatConversationPreview[] {
  return conversations.map((conversation) => {
    if (conversation.id !== message.conversationId) {
      return conversation;
    }

    const bumpsUnread = !message.isMine && !isOpenConversation;
    return {
      ...conversation,
      lastMessageSnippet: message.body ?? conversation.lastMessageSnippet,
      lastMessageAt: message.sentAt,
      unreadCount: bumpsUnread
        ? conversation.unreadCount + 1
        : conversation.unreadCount,
    };
  });
}

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

      // Dedupe against the SignalR echo: the hub broadcasts `messageReceived`
      // to the sender too, and it can land before this POST response. If that
      // id is already present, don't append it a second time.
      const alreadyPresent = state.activeConversation.messages.some(
        (m) => m.id === message.id,
      );

      return {
        ...state,
        sendingMessage: false,
        sendingMessageError: null,
        activeConversation: {
          ...state.activeConversation,
          messages: alreadyPresent
            ? state.activeConversation.messages
            : [...state.activeConversation.messages, message],
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
  on(
    ChatActions.markConversationRead,
    (state, { conversationId }): ChatState => ({
      ...state,
      conversations: state.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    }),
  ),
  on(
    ChatActions.realtimeMessageResolved,
    (state, { message }): ChatState => {
      const isOpenConversation =
        state.activeConversation !== null &&
        state.activeConversation.id === message.conversationId;

      // Dedupe against the optimistic `sendMessageSuccess` echo of our own send.
      const alreadyPresent =
        isOpenConversation &&
        state.activeConversation!.messages.some((m) => m.id === message.id);

      const conversations = applyMessageToInbox(
        state.conversations,
        message,
        isOpenConversation,
      );

      if (!isOpenConversation || alreadyPresent) {
        return { ...state, conversations };
      }

      return {
        ...state,
        conversations,
        activeConversation: {
          ...state.activeConversation!,
          messages: [...state.activeConversation!.messages, message],
        },
      };
    },
  ),
  on(
    ChatActions.realtimeConversationReadResolved,
    (state, { conversationId, readAtUtc, readerIsMe }): ChatState => {
      // The current user read the thread (elsewhere or here) → clear its unread.
      if (readerIsMe) {
        return {
          ...state,
          conversations: state.conversations.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        };
      }

      // The counterpart read the open thread → mark my delivered messages "Seen".
      if (
        state.activeConversation === null ||
        state.activeConversation.id !== conversationId
      ) {
        return state;
      }

      const readAt = new Date(readAtUtc).getTime();
      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: state.activeConversation.messages.map((m) =>
            m.isMine && !m.seen && new Date(m.sentAt).getTime() <= readAt
              ? { ...m, seen: true }
              : m,
          ),
        },
      };
    },
  ),
);
