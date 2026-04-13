import type { UserProfile } from '../models/profile.model';

export interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

export const initialProfileState: ProfileState = {
  profile: null,
  isLoading: false,
  error: null,
};
