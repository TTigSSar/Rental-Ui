import { makeListingPreview } from '../../../../testing/fixtures';
import { HomeSectionsActions } from '../../home/store/home.actions';
import type { ListingDetails } from '../../listings/models/listing-details.model';
import * as ListingsActions from '../../listings/store/listings.actions';
import * as FavoritesActions from './favorites.actions';
import { favoritesReducer } from './favorites.reducer';
import { initialFavoritesState, type FavoritesState } from './favorites.state';

function stateWith(overrides: Partial<FavoritesState>): FavoritesState {
  return { ...initialFavoritesState, ...overrides };
}

describe('favoritesReducer', () => {
  describe('loadFavoritesSuccess', () => {
    it('seeds items and favoriteIds and drops any stale pending removals', () => {
      const items = [makeListingPreview({ id: 'a' }), makeListingPreview({ id: 'b' })];
      const next = favoritesReducer(
        stateWith({ pendingRemovals: { x: { listing: makeListingPreview(), index: 0 } } }),
        FavoritesActions.loadFavoritesSuccess({ items }),
      );
      expect(next.items).toEqual(items);
      expect(next.favoriteIds).toEqual(['a', 'b']);
      expect(next.pendingRemovals).toEqual({});
      expect(next.isLoading).toBe(false);
    });
  });

  describe('toggleFavoriteOptimistic', () => {
    it('adds the id only when the listing is not in the favorites list (favoriting from elsewhere)', () => {
      const next = favoritesReducer(
        initialFavoritesState,
        ListingsActions.toggleFavoriteOptimistic({ listingId: 'new-1' }),
      );
      expect(next.favoriteIds).toContain('new-1');
      expect(next.items).toEqual([]);
      expect(next.pendingRemovals).toEqual({});
    });

    it('removes the item, snapshots its position, and drops the id when un-favoriting from the list', () => {
      const a = makeListingPreview({ id: 'a' });
      const b = makeListingPreview({ id: 'b' });
      const c = makeListingPreview({ id: 'c' });
      const start = stateWith({ items: [a, b, c], favoriteIds: ['a', 'b', 'c'] });

      const next = favoritesReducer(
        start,
        ListingsActions.toggleFavoriteOptimistic({ listingId: 'b' }),
      );
      expect(next.items.map((i) => i.id)).toEqual(['a', 'c']);
      expect(next.favoriteIds).toEqual(['a', 'c']);
      expect(next.pendingRemovals['b']).toEqual({ listing: b, index: 1 });
    });
  });

  describe('toggleFavoriteRollback', () => {
    it('removes the id when rolling back a failed add (isFavorite=false)', () => {
      const start = stateWith({ favoriteIds: ['x'] });
      const next = favoritesReducer(
        start,
        ListingsActions.toggleFavoriteRollback({ listingId: 'x', isFavorite: false }),
      );
      expect(next.favoriteIds).not.toContain('x');
    });

    it('restores the removed item at its original index when rolling back a failed removal', () => {
      const a = makeListingPreview({ id: 'a' });
      const b = makeListingPreview({ id: 'b' });
      const c = makeListingPreview({ id: 'c' });
      // 'b' was optimistically removed from index 1.
      const start = stateWith({
        items: [a, c],
        favoriteIds: ['a', 'c'],
        pendingRemovals: { b: { listing: b, index: 1 } },
      });

      const next = favoritesReducer(
        start,
        ListingsActions.toggleFavoriteRollback({ listingId: 'b', isFavorite: true }),
      );
      expect(next.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
      expect(next.favoriteIds).toContain('b');
      expect(next.pendingRemovals['b']).toBeUndefined();
    });

    it('only re-adds the id when rolling back an add that has no pending snapshot', () => {
      const next = favoritesReducer(
        initialFavoritesState,
        ListingsActions.toggleFavoriteRollback({ listingId: 'z', isFavorite: true }),
      );
      expect(next.favoriteIds).toContain('z');
      expect(next.items).toEqual([]);
    });
  });

  describe('legacy removeFavorite flow', () => {
    it('removes the item and stores a pending removal optimistically', () => {
      const a = makeListingPreview({ id: 'a' });
      const start = stateWith({ items: [a], favoriteIds: ['a'] });
      const next = favoritesReducer(
        start,
        FavoritesActions.removeFavoriteOptimistic({ listingId: 'a' }),
      );
      expect(next.items).toEqual([]);
      expect(next.favoriteIds).not.toContain('a');
      expect(next.pendingRemovals['a']).toEqual({ listing: a, index: 0 });
    });

    it('clears the pending removal on success', () => {
      const a = makeListingPreview({ id: 'a' });
      const start = stateWith({ pendingRemovals: { a: { listing: a, index: 0 } } });
      const next = favoritesReducer(
        start,
        FavoritesActions.removeFavoriteSuccess({ listingId: 'a' }),
      );
      expect(next.pendingRemovals['a']).toBeUndefined();
    });

    it('restores the item and re-adds the id on failure', () => {
      const a = makeListingPreview({ id: 'a' });
      const b = makeListingPreview({ id: 'b' });
      const start = stateWith({
        items: [b],
        favoriteIds: ['b'],
        pendingRemovals: { a: { listing: a, index: 0 } },
        error: null,
      });
      const next = favoritesReducer(
        start,
        FavoritesActions.removeFavoriteFailure({ listingId: 'a', error: 'nope' }),
      );
      expect(next.items.map((i) => i.id)).toEqual(['a', 'b']);
      expect(next.favoriteIds).toContain('a');
      expect(next.error).toBe('nope');
    });
  });

  describe('id seeding from API responses', () => {
    it('adds favorited ids from a listings page without duplicating', () => {
      const start = stateWith({ favoriteIds: ['a'] });
      const next = favoritesReducer(
        start,
        ListingsActions.loadListingsSuccess({
          items: [
            makeListingPreview({ id: 'a', isFavorite: true }),
            makeListingPreview({ id: 'b', isFavorite: true }),
            makeListingPreview({ id: 'c', isFavorite: false }),
          ],
          page: 1,
          pageSize: 20,
          hasMore: false,
        }),
      );
      expect(next.favoriteIds).toEqual(['a', 'b']);
    });

    it('returns the same state reference when there is nothing new to seed', () => {
      const start = stateWith({ favoriteIds: ['a'] });
      const next = favoritesReducer(
        start,
        ListingsActions.loadListingsSuccess({
          items: [makeListingPreview({ id: 'a', isFavorite: true })],
          page: 1,
          pageSize: 20,
          hasMore: false,
        }),
      );
      expect(next).toBe(start);
    });

    it('seeds ids flattened across home sections', () => {
      const next = favoritesReducer(
        initialFavoritesState,
        HomeSectionsActions.loadSuccess({
          sections: [
            { key: 's1', title: 'A', items: [makeListingPreview({ id: 'a', isFavorite: true })] },
            { key: 's2', title: 'B', items: [makeListingPreview({ id: 'b', isFavorite: false })] },
          ],
        }),
      );
      expect(next.favoriteIds).toEqual(['a']);
    });

    it('adds the id from a favorited listing-details response', () => {
      const next = favoritesReducer(
        initialFavoritesState,
        ListingsActions.loadListingDetailsSuccess({
          listing: { id: 'detail-1', isFavorite: true } as unknown as ListingDetails,
        }),
      );
      expect(next.favoriteIds).toContain('detail-1');
    });
  });
});
