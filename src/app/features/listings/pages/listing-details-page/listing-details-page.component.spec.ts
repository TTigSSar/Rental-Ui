import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { makeListingDetails, makeUser } from '../../../../../testing/fixtures';
import {
  ListingDetailsPageComponent,
  hasAnyToyDetail,
  resolveAgeRangeDisplay,
  resolveConditionLabelKey,
} from './listing-details-page.component';
import type { ListingDetails } from '../../models/listing-details.model';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import { bookingsFeatureKey } from '../../../bookings/store/bookings.reducer';
import { initialBookingsState } from '../../../bookings/store/bookings.state';
import { favoritesFeatureKey } from '../../../favorites/store/favorites.reducer';
import { initialFavoritesState } from '../../../favorites/store/favorites.state';
import { publicProfilesFeatureKey } from '../../../public-profiles/store/public-profiles.reducer';
import { initialPublicProfilesState } from '../../../public-profiles/store/public-profiles.state';
import { reviewsFeatureKey } from '../../../reviews/store/reviews.reducer';
import { initialReviewsState } from '../../../reviews/store/reviews.state';
import { listingsFeatureKey } from '../../store/listings.reducer';
import { initialListingsState } from '../../store/listings.state';

function baseListing(overrides: Partial<ListingDetails> = {}): ListingDetails {
  return {
    id: 'l1',
    title: 'Wooden train set',
    description: 'A lovely train set.',
    city: 'Yerevan',
    pricePerDay: 1500,
    images: [],
    owner: { id: 'u1', firstName: 'Anna', lastName: 'K' },
    bookedDateRanges: [],
    isFavorite: false,
    ...overrides,
  };
}

describe('resolveConditionLabelKey', () => {
  it.each([
    ['New', 'listings.details.conditionValues.new'],
    ['LikeNew', 'listings.details.conditionValues.likeNew'],
    ['Like New', 'listings.details.conditionValues.likeNew'],
    ['like-new', 'listings.details.conditionValues.likeNew'],
    ['Good', 'listings.details.conditionValues.good'],
    ['Fair', 'listings.details.conditionValues.fair'],
  ])('maps %s -> %s', (input, expected) => {
    expect(resolveConditionLabelKey(input)).toBe(expected);
  });

  it('returns null for an unknown or missing condition', () => {
    expect(resolveConditionLabelKey('Poor')).toBeNull();
    expect(resolveConditionLabelKey(undefined)).toBeNull();
    expect(resolveConditionLabelKey(null)).toBeNull();
    expect(resolveConditionLabelKey('')).toBeNull();
  });
});

describe('resolveAgeRangeDisplay', () => {
  it('returns the from-to key when both bounds are present', () => {
    expect(resolveAgeRangeDisplay(6, 24)).toEqual({
      key: 'listings.details.toyDetails.ageRangeFromTo',
      params: { from: 6, to: 24 },
    });
  });

  it('returns the from-only key when only the lower bound is present', () => {
    expect(resolveAgeRangeDisplay(6, null)).toEqual({
      key: 'listings.details.toyDetails.ageRangeFromOnly',
      params: { from: 6 },
    });
  });

  it('returns the to-only key when only the upper bound is present', () => {
    expect(resolveAgeRangeDisplay(undefined, 36)).toEqual({
      key: 'listings.details.toyDetails.ageRangeToOnly',
      params: { to: 36 },
    });
  });

  it('returns null when neither bound is a finite number', () => {
    expect(resolveAgeRangeDisplay(null, null)).toBeNull();
    expect(resolveAgeRangeDisplay(undefined, undefined)).toBeNull();
    expect(resolveAgeRangeDisplay(Number.NaN, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('hasAnyToyDetail', () => {
  it('is false when the listing carries no toy-trust fields', () => {
    expect(hasAnyToyDetail(baseListing())).toBe(false);
  });

  it.each([
    ['ageFromMonths', { ageFromMonths: 6 }],
    ['condition', { condition: 'Good' as const }],
    ['hygieneNotes', { hygieneNotes: 'Cleaned with baby-safe soap.' }],
    ['safetyNotes', { safetyNotes: 'Small parts — not for under 3.' }],
  ])('is true when %s is present', (_label, overrides) => {
    expect(hasAnyToyDetail(baseListing(overrides))).toBe(true);
  });

  it('is false when hygiene/safety notes are present but blank', () => {
    expect(hasAnyToyDetail(baseListing({ hygieneNotes: '   ', safetyNotes: '' }))).toBe(false);
  });
});

/**
 * Constructs the real component through Angular's DI the way the router
 * actually does — no TestBed override that could paper over a broken
 * `providers`/`imports` split. This is the regression guard for the bug
 * where `DramCurrencyPipe` was injected (`inject(DramCurrencyPipe)`) but
 * only ever listed in the component's `imports` array: `imports` makes a
 * pipe usable as `| dram` in the template, it does NOT register it as an
 * injectable, so the component threw `NG0201: No provider found for
 * DramCurrencyPipe` on every construction and the whole route rendered
 * nothing. The pure-function tests above never caught this because they
 * never went through `TestBed.createComponent`.
 */
describe('ListingDetailsPageComponent (DI construction)', () => {
  function createFixture(listingId = 'listing-1') {
    TestBed.configureTestingModule({
      imports: [ListingDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        // Real root provider (see `app.config.ts`) — unrelated to the
        // DramCurrencyPipe bug this spec guards, but the component also
        // injects `MessageService` and the real app provides it at root.
        MessageService,
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: initialListingsState,
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: initialReviewsState,
            [publicProfilesFeatureKey]: initialPublicProfilesState,
            [favoritesFeatureKey]: initialFavoritesState,
            [authFeatureKey]: initialAuthState,
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: listingId })),
          },
        },
      ],
    });

    return TestBed.createComponent(ListingDetailsPageComponent);
  }

  it('constructs without throwing NG0201 for the DramCurrencyPipe injection', () => {
    expect(() => {
      const fixture = createFixture();
      fixture.detectChanges();
    }).not.toThrow();
  });
});

/**
 * The "Report this listing" affordance is a safety control — it must never appear for a guest
 * (report submission requires authentication) or on your own listing (the server also rejects
 * this via `report.cannot_report_own`, but there's no reason to ever offer it here). See
 * `canReportListing` in `listing-details-page.component.ts`.
 */
describe('ListingDetailsPageComponent — report affordance', () => {
  function setup(options: {
    authenticated: boolean;
    userId?: string;
    ownerId?: string;
  }): ReturnType<typeof TestBed.createComponent<ListingDetailsPageComponent>> {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: {
        id: options.ownerId ?? 'owner-1',
        firstName: 'Owen',
        lastName: 'Owner',
      },
    });
    TestBed.configureTestingModule({
      imports: [ListingDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        // The "own listing" case below triggers the constructor's owner-redirect `effect`
        // (`router.navigate(['/my-listings', id])`) — a route must exist for it to resolve
        // rather than reject with NG04002 (an unhandled promise rejection Vitest would flag).
        provideRouter([{ path: 'my-listings/:id', children: [] }]),
        MessageService,
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: {
              ...initialListingsState,
              selectedListing: listing,
              isDetailsLoading: false,
            },
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: initialReviewsState,
            [publicProfilesFeatureKey]: initialPublicProfilesState,
            [favoritesFeatureKey]: initialFavoritesState,
            [authFeatureKey]: {
              ...initialAuthState,
              isAuthenticated: options.authenticated,
              user: options.authenticated ? makeUser({ id: options.userId ?? 'renter-1' }) : null,
            },
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: listing.id })) },
        },
      ],
    });
    return TestBed.createComponent(ListingDetailsPageComponent);
  }

  it('hides the report affordance for a guest', () => {
    const fixture = setup({ authenticated: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-page__pill-btn--report')).toBeNull();
  });

  it('hides the report affordance on your own listing', () => {
    const fixture = setup({ authenticated: true, userId: 'owner-1', ownerId: 'owner-1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-page__pill-btn--report')).toBeNull();
  });

  it('shows the report affordance for an authenticated non-owner', () => {
    const fixture = setup({ authenticated: true, userId: 'renter-1', ownerId: 'owner-1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-page__pill-btn--report')).not.toBeNull();
  });

  it('opens the report dialog with the lowercase "listing" target type', () => {
    const fixture = setup({ authenticated: true, userId: 'renter-1', ownerId: 'owner-1' });
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.detail-page__pill-btn--report',
    );
    button.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-report-dialog')).not.toBeNull();
  });
});

/**
 * `deliveryTypes` (additive multi-select) and the minimum-rental chip labels
 * (extended to include month/year values) both need real-DOM coverage — the
 * `deliveryType`-only path is exercised by the older tests above via
 * `makeListingDetails`' defaults, so these focus specifically on the "both
 * handover methods offered" case and the new long-period chip labels.
 */
describe('ListingDetailsPageComponent — delivery types & min-rental labels', () => {
  function setup(listingOverrides: Partial<ListingDetails>) {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: { id: 'owner-1', firstName: 'Owen', lastName: 'Owner' },
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      ...listingOverrides,
    });
    TestBed.configureTestingModule({
      imports: [ListingDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([{ path: 'my-listings/:id', children: [] }]),
        MessageService,
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: {
              ...initialListingsState,
              selectedListing: listing,
              isDetailsLoading: false,
            },
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: initialReviewsState,
            [publicProfilesFeatureKey]: initialPublicProfilesState,
            [favoritesFeatureKey]: initialFavoritesState,
            [authFeatureKey]: initialAuthState,
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: listing.id })) },
        },
      ],
    });
    // Load just the strings these tests assert on — the real bundle
    // (public/i18n/*.json) isn't wired into unit tests, so ngx-translate
    // would otherwise render the bare key (same idiom as
    // listing-location.component.spec.ts).
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation(
      'en',
      {
        listings: {
          details: {
            handoverLabel: 'Handover',
            highlights: {
              pickupOnlyTitle: 'Pickup only',
              pickupOnlySub: 'Meet the owner to collect',
              minStayTitle: '{{count}}-day minimum',
              minStayPeriodTitle: 'Min. {{period}}',
              minStaySub: "Shorter requests aren't accepted",
            },
          },
          createForm: {
            delivery: {
              both: 'Pickup or courier',
              bothHint: 'Free pickup or courier delivery in Yerevan',
              pickup: 'Pickup from me',
              pickupHint: 'Free · Meet at agreed spot',
            },
            minRental: {
              label: 'Minimum rental',
              d365: '1 year',
            },
          },
        },
      },
      true,
    );
    translate.use('en');
    return TestBed.createComponent(ListingDetailsPageComponent);
  }

  function specValues(fixture: ReturnType<typeof setup>): string[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(root.querySelectorAll<HTMLElement>('.detail-page__specquad-value')).map(
      (el) => el.textContent?.trim() ?? '',
    );
  }

  function pickupRowValues(fixture: ReturnType<typeof setup>): string[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(root.querySelectorAll<HTMLElement>('.detail-page__pickup-row-value')).map(
      (el) => el.textContent?.trim() ?? '',
    );
  }

  function highlightTitles(fixture: ReturnType<typeof setup>): string[] {
    const root = fixture.nativeElement as HTMLElement;
    return Array.from(
      root.querySelectorAll<HTMLElement>('.detail-page__highlight-cell strong'),
    ).map((el) => el.textContent?.trim() ?? '');
  }

  it('renders the "both" handover label in the specs quad when Pickup and Courier are both offered', () => {
    const fixture = setup({ deliveryTypes: ['Pickup', 'Courier'], deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(specValues(fixture)).toContain('Pickup or courier');
  });

  it('renders the "both" hint in the pickup & delivery row when both handover methods are offered', () => {
    const fixture = setup({ deliveryTypes: ['Pickup', 'Courier'], deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowValues(fixture)).toContain('Free pickup or courier delivery in Yerevan');
  });

  it('still renders the single-type label when only deliveryType (legacy) is set', () => {
    const fixture = setup({ deliveryTypes: null, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowValues(fixture)).toContain('Free · Meet at agreed spot');
    expect(pickupRowValues(fixture)).not.toContain('Free pickup or courier delivery in Yerevan');
  });

  it('shows the "1 year" chip label (not "365 nights") for a 365-day minimum rental', () => {
    const fixture = setup({ minRentalDays: 365, deliveryType: 'Pickup' });
    fixture.detectChanges();

    const rows = pickupRowValues(fixture);
    expect(rows).toContain('1 year');
    expect(rows.some((t) => t.includes('365'))).toBe(false);
  });

  it('shows the "Min. 1 year" highlight tile (not the raw day count) for a 365-day minimum rental', () => {
    const fixture = setup({ minRentalDays: 365, deliveryType: 'Pickup' });
    fixture.detectChanges();

    const titles = highlightTitles(fixture);
    expect(titles).toContain('Min. 1 year');
    expect(titles.some((t) => t.includes('365'))).toBe(false);
  });

  it('falls back to the day-count highlight copy for a non-chip minimum rental', () => {
    const fixture = setup({ minRentalDays: 5, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(highlightTitles(fixture)).toContain('5-day minimum');
  });
});

/**
 * Loss & damage compensation: the specs tile, the pickup & delivery row and
 * the protection card all decide "set vs. not specified" the same way now
 * (`isCompensationAmountSet` — finite number > 0). `0` gets its own case
 * because it's a real, reachable legacy value (the old optional-deposit
 * validator allowed it, and the depositAmount -> compensationAmount rename
 * preserved values) — before the shared helper existed, the tile/row treated
 * `0` as "not specified" while the protection card rendered "Up to 0 ֏"
 * (confirmed bug).
 */
describe('ListingDetailsPageComponent — loss & damage compensation amount', () => {
  function setup(compensationAmount: number | null) {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: { id: 'owner-1', firstName: 'Owen', lastName: 'Owner' },
      compensationAmount,
    });
    TestBed.configureTestingModule({
      imports: [ListingDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([{ path: 'my-listings/:id', children: [] }]),
        MessageService,
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: {
              ...initialListingsState,
              selectedListing: listing,
              isDetailsLoading: false,
            },
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: initialReviewsState,
            [publicProfilesFeatureKey]: initialPublicProfilesState,
            [favoritesFeatureKey]: initialFavoritesState,
            [authFeatureKey]: initialAuthState,
          },
        }),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: listing.id })) },
        },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation(
      'en',
      {
        listings: {
          details: {
            toyDetails: {
              compensation: 'Loss & damage compensation',
              compensationValue: 'Up to {{amount}}',
              compensationNotSpecified: 'Not specified',
            },
            pickupDelivery: {
              compensationLabel: 'Loss & damage compensation',
              compensationSubline: 'only if lost, damaged or not returned',
            },
            protection: {
              eyebrow: 'If something goes wrong',
              title: 'Loss & damage compensation',
              pillNoUpfront: 'Nothing charged upfront',
              intro: 'The owner sets this amount. You pay nothing upfront.',
              introNoAmount: 'The owner has not set an amount for this toy.',
            },
          },
        },
      },
      true,
    );
    translate.use('en');
    const fixture = TestBed.createComponent(ListingDetailsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ReturnType<typeof setup>, selector: string): string | undefined {
    return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim();
  }

  it('renders "Up to 45,000 ֏" in the specs tile, the pickup row and the protection card when an amount is set', () => {
    const fixture = setup(45000);

    // No other spec-tile-worthy fields are set on this fixture (age/condition/
    // delivery all null), so the compensation tile — always pushed regardless
    // of amount — is the only one rendered, making this selector unambiguous.
    expect(text(fixture, '.detail-page__specquad-value')).toBe('Up to 45,000 ֏');
    expect(text(fixture, '.detail-page__pickup-row-value')).toBe('Up to 45,000 ֏');
    expect(
      text(
        fixture,
        '.detail-page__protection-card--mobile .detail-page__protection-amount',
      ),
    ).toBe('Up to 45,000 ֏');
  });

  it.each([
    ['null (never set)', null],
    ['0 (legacy data from the old optional-deposit validator)', 0],
  ])(
    'renders "Not specified" and the no-amount intro everywhere when the amount is %s',
    (_label, amount) => {
      const fixture = setup(amount);

      expect(text(fixture, '.detail-page__specquad-value')).toBe('Not specified');
      expect(text(fixture, '.detail-page__pickup-row-value')).toBe('Not specified');
      expect(
        text(
          fixture,
          '.detail-page__protection-card--mobile .detail-page__protection-amount',
        ),
      ).toBe('Not specified');
      expect(
        text(
          fixture,
          '.detail-page__protection-card--mobile .detail-page__protection-intro',
        ),
      ).toBe('The owner has not set an amount for this toy.');
    },
  );
});
