import { createFeatureSelector, createSelector } from '@ngrx/store';

import type { ChatConversationDetails } from '../../chat/models/chat.model';
import type {
  AdminMessageThread,
  AdminMessageThreadCounts,
  AdminMessageThreadFilter,
  AdminMessageThreadQueueParams,
} from '../models/admin-message-thread.model';
import { adminMessagesFeatureKey } from './admin-messages.reducer';
import type { AdminMessagesState } from './admin-messages.state';

export const selectAdminMessagesState =
  createFeatureSelector<AdminMessagesState>(adminMessagesFeatureKey);

export const selectMessageThreadItems = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): AdminMessageThread[] => state.items,
);

export const selectMessageThreadFilter = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): AdminMessageThreadFilter => state.filter,
);

export const selectMessageThreadSearch = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string => state.search,
);

export const selectMessageThreadPage = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): number => state.page,
);

export const selectMessageThreadPageSize = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): number => state.pageSize,
);

export const selectMessageThreadTotalCount = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): number => state.totalCount,
);

export const selectMessageThreadTotalPages = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): number => state.totalPages,
);

/** Search-filtered (not pill-filtered) totals for the three filter pills — same convention as
 *  `AdminReportsSelectors.selectReportCounts`. Backs both the pill counts on the Messages screen
 *  and (via `.unread`) the admin shell's nav badge. */
export const selectMessageThreadCounts = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): AdminMessageThreadCounts => state.counts,
);

export const selectMessageThreadsLoading = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): boolean => state.isLoading,
);

export const selectMessageThreadsError = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string | null => state.error,
);

/** What the queue effect actually requests with — the initial load, filter-tab switches, the
 *  debounced search, and page changes all funnel through the same request shape, same idiom as
 *  `AdminReportsSelectors.selectReportRequestParams`. */
export const selectMessageThreadRequestParams = createSelector(
  selectMessageThreadFilter,
  selectMessageThreadSearch,
  selectMessageThreadPage,
  selectMessageThreadPageSize,
  (filter, search, page, pageSize): AdminMessageThreadQueueParams => ({
    filter,
    search,
    page,
    pageSize,
  }),
);

export const selectSelectedThreadId = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string | null => state.selectedThreadId,
);

export const selectSelectedThreadDetail = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): ChatConversationDetails | null => state.selectedThreadDetail,
);

export const selectThreadDetailLoading = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): boolean => state.detailLoading,
);

export const selectThreadDetailError = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string | null => state.detailError,
);

export const selectSendingThreadMessage = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): boolean => state.sending,
);

export const selectSendThreadMessageError = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string | null => state.sendError,
);

export const selectOpeningThreadForUser = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): boolean => state.opening,
);

export const selectOpenThreadForUserError = createSelector(
  selectAdminMessagesState,
  (state: AdminMessagesState): string | null => state.openError,
);

/**
 * True unread total across every thread the admin has, not just the currently-loaded page — the
 * shell's nav badge (`navCounts.messages`) reads this. Sourced from `counts.unread`
 * (`AdminMessageThreadQueueResponse.counts`), a filter-independent aggregate computed
 * server-side, same convention as `AdminReportsSelectors.selectReportCounts`.
 */
export const selectAdminMessagesTotalUnreadCount = createSelector(
  selectMessageThreadCounts,
  (counts: AdminMessageThreadCounts): number => counts.unread,
);
