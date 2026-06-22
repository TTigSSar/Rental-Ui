import type { ListingPreview } from '../../listings/models/listing.model';
import type { PublicUserProfile } from '../models/public-profile.model';

export interface PublicProfileEntry {
  readonly data: PublicUserProfile | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface UserListingsEntry {
  readonly data: readonly ListingPreview[] | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface PublicProfilesState {
  readonly byId: Readonly<Record<string, PublicProfileEntry>>;
  readonly userListings: Readonly<Record<string, UserListingsEntry>>;
}

export const initialPublicProfilesState: PublicProfilesState = {
  byId: {},
  userListings: {},
};
