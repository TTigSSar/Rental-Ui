import type { ChatConversationDetails } from '../../chat/models/chat.model';
import type {
  AdminMessageThread,
  AdminMessageThreadCounts,
  AdminMessageThreadFilter,
} from '../models/admin-message-thread.model';

export interface AdminMessagesState {
  // ── Queue (thread list) ──
  readonly items: AdminMessageThread[];
  readonly filter: AdminMessageThreadFilter;
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  /** Search-filtered (not pill-filtered) totals for the three filter pills — same convention as
   *  `AdminReportsState.counts`. Also backs the admin shell's nav unread badge (`counts.unread`),
   *  a true total rather than a sum over the currently-loaded page. */
  readonly counts: AdminMessageThreadCounts;
  readonly isLoading: boolean;
  readonly error: string | null;

  // ── Selected thread detail — reuses `ChatConversationDetails`, fetched via
  // `ChatApiService.getConversationDetails` (see `admin-messages.effects.ts`). ──
  readonly selectedThreadId: string | null;
  readonly selectedThreadDetail: ChatConversationDetails | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;

  // ── Send (reuses `ChatApiService.sendMessage`) ──
  readonly sending: boolean;
  readonly sendError: string | null;

  // ── Open-for-user get-or-create (`POST /api/admin/messages/threads`) — the
  // `/admin/messages?userId=…` entry point. ──
  readonly opening: boolean;
  readonly openError: string | null;
}

export const initialAdminMessagesState: AdminMessagesState = {
  items: [],
  filter: 'all',
  search: '',
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  counts: { all: 0, unread: 0, needsReply: 0 },
  isLoading: false,
  error: null,

  selectedThreadId: null,
  selectedThreadDetail: null,
  detailLoading: false,
  detailError: null,

  sending: false,
  sendError: null,

  opening: false,
  openError: null,
};
