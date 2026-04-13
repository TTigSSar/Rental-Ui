import type { ListingPreview } from '../../listings/models/listing.model';

export interface PendingFavoriteRemoval {
  listing: ListingPreview;
  index: number;
}

export interface FavoritesState {
  items: ListingPreview[];
  isLoading: boolean;
  error: string | null;
  pendingRemovals: Record<string, PendingFavoriteRemoval>;
}

export const initialFavoritesState: FavoritesState = {
  items: [],
  isLoading: false,
  error: null,
  pendingRemovals: {},
};
