import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import * as ChatActions from '../../../chat/store/chat.actions';
import { listingsFeatureKey } from '../../../listings/store/listings.reducer';
import { initialListingsState } from '../../../listings/store/listings.state';
import { reviewsFeatureKey } from '../../../reviews/store/reviews.reducer';
import { initialReviewsState } from '../../../reviews/store/reviews.state';
import type { OwnerBookingRequest } from '../../models/owner-listing.model';
import { OwnerListingService } from '../../services/owner-listing.service';
import { OwnerListingPageComponent } from './owner-listing-page.component';

/** Reaches the component's protected message handler. */
interface Internals {
  onMessage(request: OwnerBookingRequest): void;
}

describe('OwnerListingPageComponent — message renter', () => {
  it('dispatches openConversationFromBooking with the booking id and does not navigate to /chat?renter', () => {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            [authFeatureKey]: initialAuthState,
            [listingsFeatureKey]: initialListingsState,
            [reviewsFeatureKey]: initialReviewsState,
          },
        }),
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => null }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: OwnerListingService, useValue: {} },
      ],
    });

    const store = TestBed.inject(MockStore);
    const router = TestBed.inject(Router);
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const component = TestBed.runInInjectionContext(
      () => new OwnerListingPageComponent(),
    ) as unknown as Internals;

    component.onMessage({
      id: 'booking-42',
      renter: { id: 'renter-7' },
    } as unknown as OwnerBookingRequest);

    expect(dispatchSpy).toHaveBeenCalledWith(
      ChatActions.openConversationFromBooking({ bookingId: 'booking-42' }),
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
