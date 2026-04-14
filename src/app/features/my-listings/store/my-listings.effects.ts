import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { MyListingsApiService } from '../services/my-listings-api.service';
import * as MyListingsActions from './my-listings.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class MyListingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly myListingsApi = inject(MyListingsApiService);

  readonly loadMyListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(MyListingsActions.loadMyListings),
      switchMap(() =>
        this.myListingsApi.getMyListings().pipe(
          map((items) => MyListingsActions.loadMyListingsSuccess({ items })),
          catchError((error: unknown) =>
            of(
              MyListingsActions.loadMyListingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
