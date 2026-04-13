import { createAction, props } from '@ngrx/store';

import type {
  ChatConversationDetails,
  ChatConversationPreview,
  ChatMessage,
} from '../models/chat.model';

export const loadConversations = createAction('[Chat] Load Conversations');

export const loadConversationsSuccess = createAction(
  '[Chat] Load Conversations Success',
  props<{ conversations: ChatConversationPreview[] }>(),
);

export const loadConversationsFailure = createAction(
  '[Chat] Load Conversations Failure',
  props<{ error: string }>(),
);

export const loadConversationDetails = createAction(
  '[Chat] Load Conversation Details',
  props<{ conversationId: string }>(),
);

export const loadConversationDetailsSuccess = createAction(
  '[Chat] Load Conversation Details Success',
  props<{ conversation: ChatConversationDetails }>(),
);

export const loadConversationDetailsFailure = createAction(
  '[Chat] Load Conversation Details Failure',
  props<{ error: string }>(),
);

export const sendMessage = createAction(
  '[Chat] Send Message',
  props<{ conversationId: string; content: string }>(),
);

export const sendMessageSuccess = createAction(
  '[Chat] Send Message Success',
  props<{ message: ChatMessage }>(),
);

export const sendMessageFailure = createAction(
  '[Chat] Send Message Failure',
  props<{ error: string }>(),
);
