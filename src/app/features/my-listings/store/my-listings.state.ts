import type { MyListing } from '../models/my-listing.model';

export interface MyListingsState {
  items: MyListing[];
  isLoading: boolean;
  error: string | null;
}

export const initialMyListingsState: MyListingsState = {
  items: [],
  isLoading: false,
  error: null,
};
