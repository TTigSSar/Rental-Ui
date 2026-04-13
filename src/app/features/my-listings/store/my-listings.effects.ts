import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { MyListingsApiService } from '../services/my-listings-api.service';
import * as MyListingsActions from './my-listings.actions';

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
    return error.message.length > 0 ? error.message : 'Request failed';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'An unexpected error occurred';
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
