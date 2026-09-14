import { createAction, props } from '@ngrx/store';

import type { ChatConversationDetails, ChatMessage } from '../../chat/models/chat.model';
import type {
  AdminMessageThread,
  AdminMessageThreadFilter,
  AdminMessageThreadQueue,
} from '../models/admin-message-thread.model';

// ── Queue (Messages screen thread list) ─────────────────────────────────────
export const loadMessageThreads = createAction('[Admin Messages] Load Message Threads');

export const loadMessageThreadsSuccess = createAction(
  '[Admin Messages] Load Message Threads Success',
  props<{ queue: AdminMessageThreadQueue }>(),
);

export const loadMessageThreadsFailure = createAction(
  '[Admin Messages] Load Message Threads Failure',
  props<{ error: string }>(),
);

export const setMessageThreadFilter = createAction(
  '[Admin Messages] Set Filter',
  props<{ filter: AdminMessageThreadFilter }>(),
);

export const setMessageThreadSearch = createAction(
  '[Admin Messages] Set Search',
  props<{ search: string }>(),
);

export const setMessageThreadPage = createAction(
  '[Admin Messages] Set Page',
  props<{ page: number }>(),
);

// ── Thread selection / detail (reuses ChatApiService.getConversationDetails) ────────────────
export const selectMessageThread = createAction(
  '[Admin Messages] Select Thread',
  props<{ conversationId: string }>(),
);

export const loadMessageThreadDetailSuccess = createAction(
  '[Admin Messages] Load Thread Detail Success',
  props<{ conversation: ChatConversationDetails }>(),
);

export const loadMessageThreadDetailFailure = createAction(
  '[Admin Messages] Load Thread Detail Failure',
  props<{ error: string }>(),
);

/** Clears the open thread panel — e.g. leaving the Messages screen. */
export const clearSelectedMessageThread = createAction(
  '[Admin Messages] Clear Selected Thread',
);

// ── Mark read (reuses ChatApiService.markRead) — dispatched automatically on
// {@link selectMessageThread} and when a realtime message lands on the open thread. ──────────
export const markMessageThreadRead = createAction(
  '[Admin Messages] Mark Thread Read',
  props<{ conversationId: string }>(),
);

export const markMessageThreadReadSuccess = createAction(
  '[Admin Messages] Mark Thread Read Success',
  props<{ conversationId: string }>(),
);

export const markMessageThreadReadFailure = createAction(
  '[Admin Messages] Mark Thread Read Failure',
  props<{ error: string }>(),
);

// ── Send (reuses ChatApiService.sendMessage) ────────────────────────────────
export const sendMessageThreadMessage = createAction(
  '[Admin Messages] Send Message',
  props<{ conversationId: string; content: string }>(),
);

export const sendMessageThreadMessageSuccess = createAction(
  '[Admin Messages] Send Message Success',
  props<{ message: ChatMessage }>(),
);

export const sendMessageThreadMessageFailure = createAction(
  '[Admin Messages] Send Message Failure',
  props<{ error: string }>(),
);

// ── Open-for-user get-or-create — the `/admin/messages?userId=…` entry point ────────────────
export const openMessageThreadForUser = createAction(
  '[Admin Messages] Open Thread For User',
  props<{ userId: string }>(),
);

export const openMessageThreadForUserSuccess = createAction(
  '[Admin Messages] Open Thread For User Success',
  props<{ thread: AdminMessageThread }>(),
);

export const openMessageThreadForUserFailure = createAction(
  '[Admin Messages] Open Thread For User Failure',
  props<{ error: string }>(),
);

// ── Realtime — mapped in the effects from the existing, globally-dispatched chat actions
// (`ChatActions.realtimeMessageReceived` / `ChatActions.realtimeConversationRead`; see
// `admin-messages.effects.ts`). Kept as distinct admin-owned actions so the reducer never has
// to import the raw `ChatRealtimeMessage`/`ChatRealtimeReadEvent` wire shapes. ────────────────
export const threadMessageReceived = createAction(
  '[Admin Messages] Thread Message Received',
  props<{ message: ChatMessage }>(),
);

export const threadReadReceived = createAction(
  '[Admin Messages] Thread Read Received',
  props<{ conversationId: string; readAtUtc: string; readerIsAdmin: boolean }>(),
);
