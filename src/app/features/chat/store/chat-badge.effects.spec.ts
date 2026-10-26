import { TestBed } from '@angular/core/testing';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import * as BookingsActions from '../../bookings/store/bookings.actions';
import { ChatBadgeService } from '../services/chat-badge.service';
import { ChatBadgeEffects } from './chat-badge.effects';

describe('ChatBadgeEffects', () => {
  it('requests a badge refresh after the viewer own booking actions', async () => {
    const harness = actionsHarness();
    const badge = { requestRefresh: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ChatBadgeEffects,
        harness.provider,
        { provide: ChatBadgeService, useValue: badge },
      ],
    });
    const effects = TestBed.inject(ChatBadgeEffects);
    const result = collect(effects.refreshBadgeAfterBookingAction$);
    harness.send(BookingsActions.cancelBookingSuccess({ bookingId: 'b1' }));
    harness.send(
      BookingsActions.approveBookingRequestSuccess({ bookingId: 'b1', status: 'Approved' }),
    );
    harness.complete();
    await result;
    expect(badge.requestRefresh).toHaveBeenCalledTimes(2);
  });
});
