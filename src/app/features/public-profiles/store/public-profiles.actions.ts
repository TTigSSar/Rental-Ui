import { createAction, props } from '@ngrx/store';

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
