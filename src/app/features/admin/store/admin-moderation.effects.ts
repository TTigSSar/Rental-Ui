import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { catchError, concatMap, map, of, switchMap, tap } from 'rxjs';

import { toApiErrorMessage } from '../../../api/http-error-message.util';
import { AdminListingsApiService } from '../services/admin-listings-api.service';
import * as AdminModerationActions from './admin-moderation.actions';

function toErrorMessage(error: unknown): string {
  return toApiErrorMessage(error);
}

@Injectable()
export class AdminModerationEffects {
  private readonly actions$ = inject(Actions);
  private readonly adminListingsApi = inject(AdminListingsApiService);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);

  readonly loadPendingListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.loadPendingListings),
      switchMap(() =>
        this.adminListingsApi.getPendingListings().pipe(
          map((items) =>
            AdminModerationActions.loadPendingListingsSuccess({ items }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.loadPendingListingsFailure({
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly approvePendingListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.approvePendingListing),
      concatMap(({ listingId }) =>
        this.adminListingsApi.approveListing(listingId).pipe(
          map(() =>
            AdminModerationActions.approvePendingListingSuccess({ listingId }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.approvePendingListingFailure({
                listingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly rejectPendingListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AdminModerationActions.rejectPendingListing),
      concatMap(({ listingId, reason }) =>
        this.adminListingsApi.rejectListing(listingId, reason).pipe(
          map(() =>
            AdminModerationActions.rejectPendingListingSuccess({ listingId }),
          ),
          catchError((error: unknown) =>
            of(
              AdminModerationActions.rejectPendingListingFailure({
                listingId,
                error: toErrorMessage(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly approveSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AdminModerationActions.approvePendingListingSuccess),
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant(
              'admin.pendingListings.toast.approveSuccessTitle',
            ),
            detail: this.translate.instant(
              'admin.pendingListings.toast.approveSuccess',
            ),
            life: 5000,
          });
        }),
      ),
    { dispatch: false },
  );

  readonly rejectSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AdminModerationActions.rejectPendingListingSuccess),
        tap(() => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant(
              'admin.pendingListings.toast.rejectSuccessTitle',
            ),
            detail: this.translate.instant(
              'admin.pendingListings.toast.rejectSuccess',
            ),
            life: 5000,
          });
        }),
      ),
    { dispatch: false },
  );

  readonly actionFailure$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AdminModerationActions.approvePendingListingFailure,
          AdminModerationActions.rejectPendingListingFailure,
        ),
        tap(({ error }) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant(
              'admin.pendingListings.toast.actionFailureTitle',
            ),
            detail: error,
            life: 7000,
          });
        }),
      ),
    { dispatch: false },
  );
}
