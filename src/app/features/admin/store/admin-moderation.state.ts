import type { PendingListing } from '../models/pending-listing.model';

export interface AdminModerationState {
  pendingListings: PendingListing[];
  isLoading: boolean;
  error: string | null;
  actionIds: string[];
}

export const initialAdminModerationState: AdminModerationState = {
  pendingListings: [],
  isLoading: false,
  error: null,
  actionIds: [],
};
