import type {
  AdminUser,
  AdminUserQueueSummary,
  AdminUserSortOption,
  AdminUserStatusFilter,
} from '../models/admin-user.model';

/**
 * Snapshot stashed when a mutation (verify/suspend/reactivate) is dispatched, so a failure
 * can put the row back exactly where it was — same idiom as
 * `AdminModerationRollbackEntry` / the categories slice's edit rollback.
 */
export interface AdminUsersRollbackEntry {
  readonly item: AdminUser;
  readonly index: number;
}

/**
 * Single-user fetch by id, independent of the queue's `items` page — used by the Messages
 * screen's avatar → profile dialog, since `AdminMessageThreadResponse` carries no
 * email/listingCount/rentalCount and building an `AdminUser` from it would fabricate zeros (see
 * `messages-page.component.ts`'s doc comment / ADR-014). `userId` gates a stale success/failure
 * from a superseded request (belt-and-braces alongside the effect's `switchMap`) and doubles as
 * "is a lookup in flight or showing" for the page to key its dialog visibility off of.
 */
export interface AdminUserLookupState {
  readonly userId: string | null;
  readonly user: AdminUser | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface AdminUsersState {
  // ── Queue (users-page) ──
  readonly items: AdminUser[];
  /** `all | pending | suspended` — the API's filter values; "Active" is a valid row
   *  status but intentionally not offered as a tab (see `AdminUserStatusFilter`). */
  readonly statusFilter: AdminUserStatusFilter;
  readonly search: string;
  readonly sort: AdminUserSortOption;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  /** Search-filtered but NOT status-filtered aggregate — stays stable across tab
   *  switches with the same search term, same convention as the review queue's
   *  `AdminListingQueueCounts`. */
  readonly summary: AdminUserQueueSummary;
  readonly isLoading: boolean;
  readonly error: string | null;
  /** User ids with an in-flight verify/suspend/reactivate mutation. */
  readonly actionIds: string[];
  readonly rollbacks: Record<string, AdminUsersRollbackEntry>;

  // ── Single-user lookup (Messages screen profile dialog) ──
  readonly lookup: AdminUserLookupState;
}

export const initialAdminUsersState: AdminUsersState = {
  items: [],
  statusFilter: 'all',
  search: '',
  sort: 'name',
  page: 1,
  pageSize: 20,
  totalCount: 0,
  totalPages: 0,
  summary: { totalUsers: 0, verifiedCount: 0, pendingCount: 0, suspendedCount: 0 },
  isLoading: false,
  error: null,
  actionIds: [],
  rollbacks: {},
  lookup: { userId: null, user: null, loading: false, error: null },
};
