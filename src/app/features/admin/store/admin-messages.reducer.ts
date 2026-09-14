import { createReducer, on } from '@ngrx/store';

import type { ChatMessage } from '../../chat/models/chat.model';
import type { AdminMessageThread, AdminMessageThreadFilter } from '../models/admin-message-thread.model';
import * as AdminMessagesActions from './admin-messages.actions';
import { initialAdminMessagesState, type AdminMessagesState } from './admin-messages.state';

export const adminMessagesFeatureKey = 'adminMessages' as const;

function removeAt<T>(items: T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

/** `all` matches every row; `unread`/`needsReply` mirror the row's own field — same convention
 *  as `AdminReportsReducer`'s `matchesStatusFilter`. */
function matchesFilter(item: AdminMessageThread, filter: AdminMessageThreadFilter): boolean {
  if (filter === 'unread') return item.unreadCount > 0;
  if (filter === 'needsReply') return item.needsReply;
  return true;
}

/** Applies a patch to the thread row at `conversationId`, dropping it from `items` when it no
 *  longer matches the active filter (e.g. marking a row read while viewing the "Unread" tab) —
 *  same idiom as `AdminReportsReducer`'s `beginMutation`/`settleMutationSuccess` pair, but with
 *  no rollback bookkeeping since nothing here is optimistic-with-server-confirmation. */
function patchThread(
  state: AdminMessagesState,
  conversationId: string,
  patchFn: (item: AdminMessageThread) => Partial<AdminMessageThread>,
): AdminMessagesState {
  const index = state.items.findIndex((item) => item.conversationId === conversationId);
  if (index === -1) return state;
  const patched: AdminMessageThread = { ...state.items[index], ...patchFn(state.items[index]) };
  const items = matchesFilter(patched, state.filter)
    ? state.items.map((item, i) => (i === index ? patched : item))
    : removeAt(state.items, index);
  return { ...state, items };
}

/** Inserts (new thread) or replaces (existing thread) a single row at the front of the list —
 *  the get-or-create response for `openMessageThreadForUser`. */
function upsertThreadAtFront(
  state: AdminMessagesState,
  thread: AdminMessageThread,
): AdminMessagesState {
  const withoutExisting = state.items.filter((item) => item.conversationId !== thread.conversationId);
  return { ...state, items: [thread, ...withoutExisting] };
}

/** Appends a message to the open thread's detail, deduping by id (the realtime hub and a
 *  `sendMessage` response can never race against each other for the *same* id, but a realtime
 *  echo of the admin's own just-sent message could otherwise double it). */
function appendToSelectedDetail(
  state: AdminMessagesState,
  message: ChatMessage,
): AdminMessagesState {
  if (state.selectedThreadId !== message.conversationId || state.selectedThreadDetail === null) {
    return state;
  }
  if (state.selectedThreadDetail.messages.some((m) => m.id === message.id)) {
    return state;
  }
  return {
    ...state,
    selectedThreadDetail: {
      ...state.selectedThreadDetail,
      messages: [...state.selectedThreadDetail.messages, message],
    },
  };
}

export const adminMessagesReducer = createReducer(
  initialAdminMessagesState,

  // ── Queue ──
  on(
    AdminMessagesActions.loadMessageThreads,
    (state): AdminMessagesState => ({ ...state, isLoading: true, error: null }),
  ),
  on(
    AdminMessagesActions.loadMessageThreadsSuccess,
    (state, { queue }): AdminMessagesState => ({
      ...state,
      items: queue.items,
      page: queue.page,
      pageSize: queue.pageSize,
      totalCount: queue.totalCount,
      totalPages: queue.totalPages,
      counts: queue.counts,
      isLoading: false,
      error: null,
    }),
  ),
  on(
    AdminMessagesActions.loadMessageThreadsFailure,
    (state, { error }): AdminMessagesState => ({ ...state, isLoading: false, error }),
  ),
  on(
    AdminMessagesActions.setMessageThreadFilter,
    (state, { filter }): AdminMessagesState => ({ ...state, filter, page: 1 }),
  ),
  on(
    AdminMessagesActions.setMessageThreadSearch,
    (state, { search }): AdminMessagesState => ({ ...state, search, page: 1 }),
  ),
  on(
    AdminMessagesActions.setMessageThreadPage,
    (state, { page }): AdminMessagesState => ({ ...state, page }),
  ),

  // ── Thread selection / detail ──
  on(
    AdminMessagesActions.selectMessageThread,
    (state, { conversationId }): AdminMessagesState => ({
      ...state,
      selectedThreadId: conversationId,
      selectedThreadDetail: null,
      detailLoading: true,
      detailError: null,
    }),
  ),
  on(
    AdminMessagesActions.loadMessageThreadDetailSuccess,
    (state, { conversation }): AdminMessagesState => ({
      ...state,
      // A slower-arriving response for a thread the admin has since navigated away from must
      // not clobber the (possibly already-different) selection.
      selectedThreadDetail: state.selectedThreadId === conversation.id ? conversation : state.selectedThreadDetail,
      detailLoading: false,
      detailError: null,
    }),
  ),
  on(
    AdminMessagesActions.loadMessageThreadDetailFailure,
    (state, { error }): AdminMessagesState => ({ ...state, detailLoading: false, detailError: error }),
  ),
  on(
    AdminMessagesActions.clearSelectedMessageThread,
    (state): AdminMessagesState => ({
      ...state,
      selectedThreadId: null,
      selectedThreadDetail: null,
      detailLoading: false,
      detailError: null,
    }),
  ),

  // ── Mark read ──
  on(
    AdminMessagesActions.markMessageThreadReadSuccess,
    (state, { conversationId }): AdminMessagesState =>
      patchThread(state, conversationId, () => ({ unreadCount: 0 })),
  ),
  on(
    AdminMessagesActions.markMessageThreadReadFailure,
    (state, { error }): AdminMessagesState => ({ ...state, error }),
  ),

  // ── Send ──
  on(
    AdminMessagesActions.sendMessageThreadMessage,
    (state): AdminMessagesState => ({ ...state, sending: true, sendError: null }),
  ),
  on(AdminMessagesActions.sendMessageThreadMessageSuccess, (state, { message }): AdminMessagesState => {
    const withDetail = appendToSelectedDetail(state, message);
    const withPreview = patchThread(withDetail, message.conversationId, () => ({
      lastMessageSnippet: message.body,
      lastMessageAt: message.sentAt,
      needsReply: false,
    }));
    return { ...withPreview, sending: false, sendError: null };
  }),
  on(
    AdminMessagesActions.sendMessageThreadMessageFailure,
    (state, { error }): AdminMessagesState => ({ ...state, sending: false, sendError: error }),
  ),

  // ── Open-for-user (get-or-create) ──
  on(
    AdminMessagesActions.openMessageThreadForUser,
    (state): AdminMessagesState => ({ ...state, opening: true, openError: null }),
  ),
  on(AdminMessagesActions.openMessageThreadForUserSuccess, (state, { thread }): AdminMessagesState => {
    const next = upsertThreadAtFront(state, thread);
    return { ...next, opening: false, openError: null };
  }),
  on(
    AdminMessagesActions.openMessageThreadForUserFailure,
    (state, { error }): AdminMessagesState => ({ ...state, opening: false, openError: error }),
  ),

  // ── Realtime ──
  on(AdminMessagesActions.threadMessageReceived, (state, { message }): AdminMessagesState => {
    const withDetail = appendToSelectedDetail(state, message);
    const index = withDetail.items.findIndex((item) => item.conversationId === message.conversationId);
    if (index === -1) return withDetail;

    const original = withDetail.items[index];
    const isOpen = withDetail.selectedThreadId === message.conversationId;
    const fromMember = message.senderId !== null && message.senderId === original.memberId;

    return patchThread(withDetail, message.conversationId, () => ({
      lastMessageSnippet: message.body,
      lastMessageAt: message.sentAt,
      needsReply: fromMember,
      unreadCount: fromMember && !isOpen ? original.unreadCount + 1 : original.unreadCount,
    }));
  }),
  on(
    AdminMessagesActions.threadReadReceived,
    (state, { conversationId, readerIsAdmin }): AdminMessagesState =>
      readerIsAdmin ? patchThread(state, conversationId, () => ({ unreadCount: 0 })) : state,
  ),
);
