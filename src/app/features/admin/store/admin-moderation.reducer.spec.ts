import { makePendingListing } from '../../../../testing/fixtures';
import * as AdminModerationActions from './admin-moderation.actions';
import { adminModerationReducer } from './admin-moderation.reducer';
import {
  initialAdminModerationState,
  type AdminModerationState,
} from './admin-moderation.state';

function stateWith(overrides: Partial<AdminModerationState>): AdminModerationState {
  return { ...initialAdminModerationState, ...overrides };
}

describe('adminModerationReducer', () => {
  it('replaces the queue on load success', () => {
    const items = [makePendingListing({ id: 'p1' }), makePendingListing({ id: 'p2' })];
    const next = adminModerationReducer(
      stateWith({ isLoading: true }),
      AdminModerationActions.loadPendingListingsSuccess({ items }),
    );
    expect(next.pendingListings).toEqual(items);
    expect(next.isLoading).toBe(false);
    expect(next.error).toBeNull();
  });

  describe('per-listing action tracking', () => {
    it('marks a listing as acting on approve and reject without duplicates', () => {
      const approving = adminModerationReducer(
        initialAdminModerationState,
        AdminModerationActions.approvePendingListing({ listingId: 'p1' }),
      );
      expect(approving.actionIds).toEqual(['p1']);

      const again = adminModerationReducer(
        approving,
        AdminModerationActions.approvePendingListing({ listingId: 'p1' }),
      );
      expect(again.actionIds).toEqual(['p1']);

      const rejecting = adminModerationReducer(
        approving,
        AdminModerationActions.rejectPendingListing({ listingId: 'p2', reasonCode: 'spam', note: '' }),
      );
      expect(rejecting.actionIds).toEqual(['p1', 'p2']);
    });

    it('removes the listing from the queue and clears its action id on approve success', () => {
      const start = stateWith({
        pendingListings: [makePendingListing({ id: 'p1' }), makePendingListing({ id: 'p2' })],
        actionIds: ['p1'],
      });
      const next = adminModerationReducer(
        start,
        AdminModerationActions.approvePendingListingSuccess({ listingId: 'p1' }),
      );
      expect(next.pendingListings.map((l) => l.id)).toEqual(['p2']);
      expect(next.actionIds).toEqual([]);
    });

    it('removes the listing from the queue on reject success', () => {
      const start = stateWith({
        pendingListings: [makePendingListing({ id: 'p1' }), makePendingListing({ id: 'p2' })],
        actionIds: ['p2'],
      });
      const next = adminModerationReducer(
        start,
        AdminModerationActions.rejectPendingListingSuccess({ listingId: 'p2' }),
      );
      expect(next.pendingListings.map((l) => l.id)).toEqual(['p1']);
      expect(next.actionIds).toEqual([]);
    });

    it('keeps the listing in the queue but clears the action id and records the error on failure', () => {
      const start = stateWith({
        pendingListings: [makePendingListing({ id: 'p1' })],
        actionIds: ['p1'],
      });
      const next = adminModerationReducer(
        start,
        AdminModerationActions.approvePendingListingFailure({ listingId: 'p1', error: 'nope' }),
      );
      expect(next.pendingListings.map((l) => l.id)).toEqual(['p1']);
      expect(next.actionIds).toEqual([]);
      expect(next.error).toBe('nope');
    });
  });
});
