import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiContract, toApiUrl } from '../../../api/api-contract';
import type {
  AdminMarketplaceRole,
  AdminMessageThread,
  AdminMessageThreadCounts,
  AdminMessageThreadFilter,
  AdminMessageThreadQueue,
  AdminMessageThreadQueueParams,
  AdminUserStatus,
  OpenAdminMessageThreadRequest,
} from '../models/admin-message-thread.model';

const THREAD_FILTERS = new Set<AdminMessageThreadFilter>(['all', 'unread', 'needsReply']);
const MEMBER_STATUSES = new Set<AdminUserStatus>(['Pending', 'Active', 'Suspended']);
const MEMBER_MARKETPLACE_ROLES = new Set<AdminMarketplaceRole>(['Renter', 'Owner', 'Both']);

// Unrecognised/missing filter falls back to "all" — same convention as
// AdminReportsApiService/AdminUsersApiService coercers below; only affects a locally-crafted
// request, never a value we didn't just send ourselves.
function coerceThreadFilter(value: unknown): AdminMessageThreadFilter {
  return typeof value === 'string' && THREAD_FILTERS.has(value as AdminMessageThreadFilter)
    ? (value as AdminMessageThreadFilter)
    : 'all';
}

// Unrecognised/missing member status falls back to "Pending" — the safest "needs a closer look"
// reading, same convention as AdminUsersApiService's coerceAdminUserStatus.
function coerceMemberStatus(value: unknown): AdminUserStatus {
  return typeof value === 'string' && MEMBER_STATUSES.has(value as AdminUserStatus)
    ? (value as AdminUserStatus)
    : 'Pending';
}

// Unrecognised/missing marketplace role falls back to "Renter" — same default
// AdminUsersApiService's coerceAdminMarketplaceRole uses for a brand-new account.
function coerceMemberMarketplaceRole(value: unknown): AdminMarketplaceRole {
  return typeof value === 'string' &&
    MEMBER_MARKETPLACE_ROLES.has(value as AdminMarketplaceRole)
    ? (value as AdminMarketplaceRole)
    : 'Renter';
}

function toNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isRecordWithConversationId(
  item: unknown,
): item is Record<string, unknown> & { conversationId: string } {
  return (
    item !== null &&
    typeof item === 'object' &&
    typeof (item as Record<string, unknown>)['conversationId'] === 'string'
  );
}

// Guards the get-or-create response against a malformed or non-object payload without
// throwing — falls back to a synthetic record keyed by the id we already requested, same
// pattern as AdminReportsApiService's toAdminReportRecord / AdminUsersApiService's
// toAdminUserRecord (those fall back to the *report/user* id; here there is no conversation id
// to fall back to yet, so normalizeAdminMessageThread's own '' default takes over — a caller
// should never see this fallback in practice since a get-or-create 200 always carries a
// conversationId).
function toAdminMessageThreadRecord(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

function normalizeAdminMessageThread(raw: Record<string, unknown>): AdminMessageThread {
  return {
    conversationId: typeof raw['conversationId'] === 'string' ? raw['conversationId'] : '',

    memberId: typeof raw['memberId'] === 'string' ? raw['memberId'] : '',
    memberFirstName: typeof raw['memberFirstName'] === 'string' ? raw['memberFirstName'] : '',
    memberLastName: typeof raw['memberLastName'] === 'string' ? raw['memberLastName'] : '',
    memberAvatarUrl: toNullableString(raw['memberAvatarUrl']),

    memberStatus: coerceMemberStatus(raw['memberStatus']),
    memberIsIdConfirmed: raw['memberIsIdConfirmed'] === true,

    memberMarketplaceRole: coerceMemberMarketplaceRole(raw['memberMarketplaceRole']),

    memberOpenFlagCount: toNonNegativeInteger(raw['memberOpenFlagCount']),

    unreadCount: toNonNegativeInteger(raw['unreadCount']),
    lastMessageSnippet: toNullableString(raw['lastMessageSnippet']),
    lastMessageAt: toNullableString(raw['lastMessageAt']),
    lastMessageType: toNullableString(raw['lastMessageType']),
    lastMessageNoteSubject: toNullableString(raw['lastMessageNoteSubject']),

    needsReply: raw['needsReply'] === true,

    createdAt:
      typeof raw['createdAt'] === 'string' && raw['createdAt'].length > 0 ? raw['createdAt'] : '',
  };
}

function normalizeAdminMessageThreadCounts(raw: unknown): AdminMessageThreadCounts {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    all: toNonNegativeInteger(obj['all']),
    unread: toNonNegativeInteger(obj['unread']),
    needsReply: toNonNegativeInteger(obj['needsReply']),
  };
}

function normalizeAdminMessageThreadQueue(raw: unknown): AdminMessageThreadQueue {
  const obj = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const items = Array.isArray(obj['items']) ? obj['items'] : [];
  return {
    items: items
      .filter(isRecordWithConversationId)
      .map((item) => normalizeAdminMessageThread(item)),
    page: toNonNegativeInteger(obj['page']),
    pageSize: toNonNegativeInteger(obj['pageSize']),
    totalCount: toNonNegativeInteger(obj['totalCount']),
    totalPages: toNonNegativeInteger(obj['totalPages']),
    counts: normalizeAdminMessageThreadCounts(obj['counts']),
  };
}

function buildAdminMessageThreadQueueParams(
  params: AdminMessageThreadQueueParams | undefined,
): HttpParams {
  let httpParams = new HttpParams();
  if (!params) return httpParams;

  if (params.filter) {
    httpParams = httpParams.set('filter', coerceThreadFilter(params.filter));
  }
  const search = params.search?.trim();
  if (search) {
    httpParams = httpParams.set('search', search);
  }
  if (params.page !== undefined) {
    httpParams = httpParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    httpParams = httpParams.set('pageSize', String(params.pageSize));
  }
  return httpParams;
}

/**
 * Admin console: the Messages screen thread queue only (list + get-or-create). Thread
 * detail/send/mark-read deliberately reuse `ChatApiService` (`features/chat/services/`) — see
 * `admin-message-thread.model.ts`'s header comment — so they are NOT duplicated here.
 */
@Injectable({ providedIn: 'root' })
export class AdminMessagesApiService {
  private readonly http = inject(HttpClient);

  getThreads(params?: AdminMessageThreadQueueParams): Observable<AdminMessageThreadQueue> {
    return this.http
      .get<unknown>(toApiUrl(ApiContract.adminMessages.threads), {
        params: buildAdminMessageThreadQueueParams(params),
      })
      .pipe(map((raw) => normalizeAdminMessageThreadQueue(raw)));
  }

  /** Get-or-create the Moderation thread for this member. */
  openThreadForUser(userId: string): Observable<AdminMessageThread> {
    const body: OpenAdminMessageThreadRequest = { userId };
    return this.http
      .post<unknown>(toApiUrl(ApiContract.adminMessages.threads), body)
      .pipe(map((raw) => normalizeAdminMessageThread(toAdminMessageThreadRecord(raw))));
  }
}
