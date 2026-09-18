import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { makeListingDetails } from '../../../../../testing/fixtures';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import { bookingsFeatureKey } from '../../../bookings/store/bookings.reducer';
import { initialBookingsState } from '../../../bookings/store/bookings.state';
import { chatFeatureKey } from '../../../chat/store/chat.reducer';
import { initialChatState } from '../../../chat/store/chat.state';
import { publicProfilesFeatureKey } from '../../../public-profiles/store/public-profiles.reducer';
import { initialPublicProfilesState } from '../../../public-profiles/store/public-profiles.state';
import { reviewsFeatureKey } from '../../../reviews/store/reviews.reducer';
import { initialReviewsState } from '../../../reviews/store/reviews.state';
import { listingsFeatureKey } from '../../store/listings.reducer';
import { initialListingsState } from '../../store/listings.state';
import { ListingBookingPageComponent } from './listing-booking-page.component';

const LISTING_ID = 'listing-1';

/** Reaches the component's reactive form + submit handler (protected on the class). */
interface ProtectedApi {
  readonly form: {
    readonly controls: {
      readonly noteForOwner: { setValue(value: string): void };
    };
  };
  onRangeChange(event: { startDate: Date | null; endDate: Date | null }): void;
  onSubmit(): void;
}

function createFixture() {
  TestBed.configureTestingModule({
    imports: [ListingBookingPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [listingsFeatureKey]: {
            ...initialListingsState,
            selectedListing: makeListingDetails({
              id: LISTING_ID,
              pricePerDay: 1000,
              compensationAmount: 5000,
              owner: {
                id: 'owner-1',
                firstName: 'Owen',
                lastName: 'Owner',
              },
            }),
          },
          [bookingsFeatureKey]: initialBookingsState,
          [reviewsFeatureKey]: initialReviewsState,
          [publicProfilesFeatureKey]: initialPublicProfilesState,
          [chatFeatureKey]: initialChatState,
        },
      }),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id: LISTING_ID })),
        },
      },
    ],
  });

  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(ListingBookingPageComponent);
  fixture.detectChanges();
  const api = fixture.componentInstance as unknown as ProtectedApi;
  return { fixture, store, api };
}

/** Finds the `createBooking` action among everything dispatched during a test. */
function findCreateBookingDispatch(dispatchSpy: {
  mock: { calls: unknown[][] };
}): ReturnType<typeof BookingsActions.createBooking> | undefined {
  return dispatchSpy.mock.calls
    .map(([action]) => action as Action)
    .find(
      (action): action is ReturnType<typeof BookingsActions.createBooking> =>
        action.type === BookingsActions.createBooking.type,
    );
}

/** Selects a 2-day range starting today so `canSubmit()` is true. */
function selectValidDateRange(api: ProtectedApi): void {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  api.onRangeChange({ startDate: start, endDate: end });
}

describe('ListingBookingPageComponent', () => {
  it('sends the trimmed note as `note` in the createBooking payload', () => {
    const { store, api } = createFixture();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    selectValidDateRange(api);
    api.form.controls.noteForOwner.setValue('  Pick up after 6pm, please!  ');
    api.onSubmit();

    const createBookingCall = findCreateBookingDispatch(dispatchSpy);

    expect(createBookingCall).toBeDefined();
    expect(createBookingCall?.payload.note).toBe('Pick up after 6pm, please!');
    expect(createBookingCall?.payload.listingId).toBe(LISTING_ID);
  });

  it('sends `null` (not an empty string) for a whitespace-only note', () => {
    const { store, api } = createFixture();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    selectValidDateRange(api);
    api.form.controls.noteForOwner.setValue('   \n\t  ');
    api.onSubmit();

    const createBookingCall = findCreateBookingDispatch(dispatchSpy);

    expect(createBookingCall).toBeDefined();
    expect(createBookingCall?.payload.note).toBeNull();
  });

  it('sends `null` when no note was entered at all', () => {
    const { store, api } = createFixture();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    selectValidDateRange(api);
    api.onSubmit();

    const createBookingCall = findCreateBookingDispatch(dispatchSpy);

    expect(createBookingCall).toBeDefined();
    expect(createBookingCall?.payload.note).toBeNull();
  });
});

/**
 * Loss & damage compensation row + "How this works" popover.
 *
 * The popover regression: `onDocumentMouseDown` used to test containment
 * against the whole component host (`elementRef`, the entire routed booking
 * page), so a click on the calendar, the note field, or any blank space on
 * the page — all still "inside the host" — left the popover open; only a
 * click that landed outside the host entirely (header/footer) closed it.
 * Fixed by testing containment against `.booking-page__comp-info-wrap`
 * (trigger + popover only) instead. These tests append the fixture to
 * `document.body` so real DOM event bubbling exercises the actual
 * `document:mousedown` listener with a real, attached click target — a bare
 * `document.dispatchEvent(...)` with no real target wouldn't distinguish
 * the old buggy behaviour from the fix (neither host nor wrap ever
 * "contains" `document` itself).
 */
describe('ListingBookingPageComponent — loss & damage compensation row + popover', () => {
  function createFixtureWithTranslations() {
    TestBed.configureTestingModule({
      imports: [ListingBookingPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: {
              ...initialListingsState,
              selectedListing: makeListingDetails({
                id: LISTING_ID,
                pricePerDay: 1000,
                compensationAmount: 5000,
                owner: {
                  id: 'owner-1',
                  firstName: 'Owen',
                  lastName: 'Owner',
                },
              }),
            },
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: initialReviewsState,
            [publicProfilesFeatureKey]: initialPublicProfilesState,
            [chatFeatureKey]: initialChatState,
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: LISTING_ID })) },
        },
      ],
    });

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation(
      'en',
      {
        listings: {
          createPage: { wizard: { compensationUpTo: 'Up to {{amount}}' } },
          details: { toyDetails: { compensationNotSpecified: 'Not specified' } },
        },
      },
      true,
    );
    translate.use('en');

    const fixture = TestBed.createComponent(ListingBookingPageComponent);
    fixture.detectChanges();
    const api = fixture.componentInstance as unknown as ProtectedApi;
    return { fixture, api };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  function openPopover(
    fixture: ReturnType<typeof createFixtureWithTranslations>['fixture'],
    api: ProtectedApi,
  ): HTMLButtonElement {
    selectValidDateRange(api);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const btn = fixture.nativeElement.querySelector(
      '.booking-page__comp-info-btn',
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();
    return btn;
  }

  it('shows the amount in the row and excludes it from the total', () => {
    const { fixture, api } = createFixtureWithTranslations();
    // 2 days @ 1,000 ֏/day = 2,000 ֏ total; the 5,000 ֏ compensation amount
    // must not be folded in.
    selectValidDateRange(api);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.booking-page__comp-value')?.textContent?.trim()).toBe(
      'Up to 5,000 ֏',
    );
    expect(
      root.querySelector('.booking-page__breakdown-row--total dd')?.textContent?.trim(),
    ).toBe('2,000 ֏');
  });

  it('opens the "How this works" popover on the info button', () => {
    const { fixture, api } = createFixtureWithTranslations();
    const btn = openPopover(fixture, api);

    expect(fixture.nativeElement.querySelector('.booking-page__comp-popover')).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape and returns focus to the trigger button', () => {
    const { fixture, api } = createFixtureWithTranslations();
    const btn = openPopover(fixture, api);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.booking-page__comp-popover')).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it('closes on a click elsewhere on the page — e.g. the note field (regression)', () => {
    const { fixture, api } = createFixtureWithTranslations();
    openPopover(fixture, api);

    const noteField = document.getElementById('noteForOwner');
    expect(noteField).not.toBeNull();
    noteField!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.booking-page__comp-popover')).toBeNull();
  });

  it('stays open when clicking inside the popover itself', () => {
    const { fixture, api } = createFixtureWithTranslations();
    openPopover(fixture, api);

    const popoverTitle = fixture.nativeElement.querySelector(
      '.booking-page__comp-popover-title',
    ) as HTMLElement;
    expect(popoverTitle).not.toBeNull();
    popoverTitle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.booking-page__comp-popover')).not.toBeNull();
  });
});
