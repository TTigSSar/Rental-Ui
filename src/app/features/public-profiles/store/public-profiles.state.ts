import type { PublicUserProfile } from '../models/public-profile.model';

export interface PublicProfileEntry {
  readonly data: PublicUserProfile | null;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export interface PublicProfilesState {
  readonly byId: Readonly<Record<string, PublicProfileEntry>>;
}

export const initialPublicProfilesState: PublicProfilesState = {
  byId: {},
};
