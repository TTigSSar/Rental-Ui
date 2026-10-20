import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { tap } from 'rxjs';

import * as BookingsActions from '../../bookings/store/bookings.actions';
import { ChatBadgeService } from '../services/chat-badge.service';

/**
 * Root-registered (app.config) so it runs on every route, including ones where
 * the lazy `ChatEffects` is not provided (e.g. /profile/*). The viewer's own
 * booking action can change what the server counts as unread, so refresh the
 * global badge right away (debounced and sign-in gated in the service).
 */
@Injectable()
export class ChatBadgeEffects {
  private readonly actions$ = inject(Actions);
  private readonly chatBadge = inject(ChatBadgeService);

  readonly refreshBadgeAfterBookingAction$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          BookingsActions.approveBookingRequestSuccess,
          BookingsActions.rejectBookingRequestSuccess,
          BookingsActions.cancelBookingSuccess,
          BookingsActions.bookingActionSuccess,
        ),
        tap(() => this.chatBadge.requestRefresh()),
      ),
    { dispatch: false },
  );
}
