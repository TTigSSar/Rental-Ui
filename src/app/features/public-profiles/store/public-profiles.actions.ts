import { createAction, props } from '@ngrx/store';

import type { ListingPreview } from '../../listings/models/listing.model';
import type { PublicUserProfile } from '../models/public-profile.model';

export const loadPublicProfile = createAction(
  '[PublicProfiles] Load Public Profile',
  props<{ userId: string }>(),
);

export const loadPublicProfileSuccess = createAction(
  '[PublicProfiles] Load Public Profile Success',
  props<{ userId: string; profile: PublicUserProfile }>(),
);

export const loadPublicProfileFailure = createAction(
  '[PublicProfiles] Load Public Profile Failure',
  props<{ userId: string; error: string }>(),
);

export const loadUserListings = createAction(
  '[PublicProfiles] Load User Listings',
  props<{ userId: string }>(),
);

export const loadUserListingsSuccess = createAction(
  '[PublicProfiles] Load User Listings Success',
  props<{ userId: string; listings: ListingPreview[] }>(),
);

export const loadUserListingsFailure = createAction(
  '[PublicProfiles] Load User Listings Failure',
  props<{ userId: string; error: string }>(),
);
