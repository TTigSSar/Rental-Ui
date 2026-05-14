import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { HomeApiService } from '../services/home-api.service';
import { HomeSectionsActions } from './home.actions';

@Injectable()
export class HomeEffects {
  private readonly actions$ = inject(Actions);
  private readonly homeApi = inject(HomeApiService);

  readonly loadSections$ = createEffect(() =>
    this.actions$.pipe(
      ofType(HomeSectionsActions.load),
      switchMap(() =>
        this.homeApi.getHomeSections().pipe(
          map((sections) => HomeSectionsActions.loadSuccess({ sections })),
          catchError((error: unknown) =>
            of(
              HomeSectionsActions.loadFailure({
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to load toy sections',
              }),
            ),
          ),
        ),
      ),
    ),
  );
}
