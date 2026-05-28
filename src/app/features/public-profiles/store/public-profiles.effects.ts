import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, of } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { PublicProfileApiService } from '../services/public-profile-api.service';
import * as PublicProfilesActions from './public-profiles.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class PublicProfilesEffects {
  private readonly actions$ = inject(Actions);
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
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
