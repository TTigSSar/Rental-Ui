import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';

import { ApiErrorMapper } from '../../../api/api-error-mapper';
import { PublicProfileApiService } from '../services/public-profile-api.service';
import * as PublicProfilesActions from './public-profiles.actions';

@Injectable()
export class PublicProfilesEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly api = inject(PublicProfileApiService);

  readonly loadPublicProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PublicProfilesActions.loadPublicProfile),
      mergeMap(({ userId }) =>
        this.api.getPublicProfile(userId).pipe(
          map((profile) =>
            PublicProfilesActions.loadPublicProfileSuccess({ userId, profile }),
          ),
          catchError((error: unknown) =>
            of(
              PublicProfilesActions.loadPublicProfileFailure({
                userId,
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadUserListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PublicProfilesActions.loadUserListings),
      mergeMap(({ userId }) =>
        this.api.getUserListings(userId).pipe(
          map((listings) =>
            PublicProfilesActions.loadUserListingsSuccess({ userId, listings }),
          ),
          catchError((error: unknown) =>
            of(
              PublicProfilesActions.loadUserListingsFailure({
                userId,
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
