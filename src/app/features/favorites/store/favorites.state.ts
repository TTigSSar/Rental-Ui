import type { ListingPreview } from '../../listings/models/listing.model';

export interface PendingFavoriteRemoval {
  listing: ListingPreview;
  index: number;
}

export interface FavoritesState {
  items: ListingPreview[];
  /** Single source of truth for which listing IDs are currently favorited. */
  favoriteIds: readonly string[];
  isLoading: boolean;
  error: string | null;
  pendingRemovals: Record<string, PendingFavoriteRemoval>;
}

export const initialFavoritesState: FavoritesState = {
  items: [],
  favoriteIds: [],
  isLoading: false,
  error: null,
  pendingRemovals: {},
};
