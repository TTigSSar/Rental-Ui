import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { EMPTY } from 'rxjs';

import { makeBookingDetail, makeReviewStatus } from '../../../../../testing/fixtures';
import type { BookingReviewStatus } from '../../../reviews/models/review.model';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import { selectBookingDetail } from '../../store/bookings.selectors';
import { BookingDetailsPageComponent } from './booking-details-page.component';

/**
 * Tests the review-eligibility computeds in isolation. The component is created
 * but never rendered (no detectChanges), so the signal-based business rules are
 * exercised without dragging in the template, translations, or child components.
 */
interface Internals {
  reviewStatus: { set(v: BookingReviewStatus | null): void };
  canLeaveReview(): boolean;
  reviewSubmitted(): boolean;
  reviewLink(): string[];
}

function createComponent(detailRole: 'owner' | 'renter' | null) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: ReviewsApiService, useValue: { getBookingStatus: () => EMPTY } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => 'booking-1' } } },
      },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(
    selectBookingDetail,
    detailRole === null ? null : makeBookingDetail({ id: 'booking-1', role: detailRole }),
  );
  const fixture = TestBed.createComponent(BookingDetailsPageComponent);
  return fixture.componentInstance as unknown as Internals;
}

describe('BookingDetailsPageComponent review eligibility', () => {
  it('cannot leave a review until the eligibility status has loaded', () => {
    const c = createComponent('renter');
    expect(c.canLeaveReview()).toBe(false);
    expect(c.reviewSubmitted()).toBe(false);
  });

  describe('renter side', () => {
    it('can review when either the toy or the owner is reviewable', () => {
      const c = createComponent('renter');
      c.reviewStatus.set(
        makeReviewStatus({ role: 'renter', canReviewToy: false, canReviewOwner: true }),
      );
      expect(c.canLeaveReview()).toBe(true);
    });

    it('cannot review when neither side is reviewable', () => {
      const c = createComponent('renter');
      c.reviewStatus.set(
        makeReviewStatus({ role: 'renter', canReviewToy: false, canReviewOwner: false }),
      );
      expect(c.canLeaveReview()).toBe(false);
    });

    it('counts the review as submitted only when both toy and owner are done', () => {
      const c = createComponent('renter');
      c.reviewStatus.set(
        makeReviewStatus({ role: 'renter', hasToyReview: true, hasOwnerReview: false }),
      );
      expect(c.reviewSubmitted()).toBe(false);
      c.reviewStatus.set(
        makeReviewStatus({ role: 'renter', hasToyReview: true, hasOwnerReview: true }),
      );
      expect(c.reviewSubmitted()).toBe(true);
    });

    it('points the review link at the renter flow', () => {
      const c = createComponent('renter');
      expect(c.reviewLink()).toEqual(['/bookings', 'booking-1', 'review']);
    });
  });

  describe('owner side', () => {
    it('can review based solely on canReviewRenter', () => {
      const c = createComponent('owner');
      c.reviewStatus.set(makeReviewStatus({ role: 'owner', canReviewRenter: true }));
      expect(c.canLeaveReview()).toBe(true);

      c.reviewStatus.set(makeReviewStatus({ role: 'owner', canReviewRenter: false }));
      expect(c.canLeaveReview()).toBe(false);
    });

    it('counts as submitted when the renter review exists', () => {
      const c = createComponent('owner');
      c.reviewStatus.set(makeReviewStatus({ role: 'owner', hasRenterReview: true }));
      expect(c.reviewSubmitted()).toBe(true);
    });

    it('points the review link at the rate-renter flow', () => {
      const c = createComponent('owner');
      expect(c.reviewLink()).toEqual(['/bookings', 'booking-1', 'review', 'renter']);
    });
  });
});
