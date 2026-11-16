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
    owner: { id: 'u1', firstName: 'Anna', lastName: 'K', isDeleted: false },
    bookedDateRanges: [],
    isFavorite: false,
    ...overrides,
  };
}

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
    ownerIsDeleted?: boolean;
  }): ReturnType<typeof TestBed.createComponent<ListingDetailsPageComponent>> {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: {
        id: options.ownerId ?? 'owner-1',
        firstName: 'Owen',
        lastName: 'Owner',
        isDeleted: options.ownerIsDeleted ?? false,
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

  it('renders a deleted owner as the shared avatar + plain text, with no profile links (ADR-056)', () => {
    const fixture = setup({ authenticated: false, ownerIsDeleted: true });
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.detail-page__owner-card') as HTMLElement;
    expect(card.querySelector('app-deleted-user-avatar')).not.toBeNull();
    expect(card.querySelector('app-deleted-user-name')).not.toBeNull();
    expect(card.querySelector('a[href*="/users/"]')).toBeNull();
    expect(card.textContent).not.toContain('Owen');
  });

  it('keeps the owner profile link for a live owner', () => {
    const fixture = setup({ authenticated: false });
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.detail-page__owner-card') as HTMLElement;
    expect(card.querySelector('a[href="/users/owner-1"]')).not.toBeNull();
    expect(card.querySelector('app-deleted-user-avatar')).toBeNull();
  });

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
 * Details tiles (Age / Condition / Hygiene) and the rows beside the map
 * (Handover / Minimum rental), plus the clickable "{district}, {city}" line.
 * The highlights band is gone — each fact has exactly one home.
 */
describe('ListingDetailsPageComponent — details tiles, map rows & location line', () => {
  function setup(listingOverrides: Partial<ListingDetails>) {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: { id: 'owner-1', firstName: 'Owen', lastName: 'Owner', isDeleted: false },
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
          card: { hygieneProvided: 'Hygiene notes' },
          details: {
            handoverLabel: 'Handover',
            showLocationOnMap: 'Show location on map',
            toyDetails: {
              ageRange: 'Recommended age',
              condition: 'Condition',
              hygieneValue: 'Cleaning details from the owner',
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
              d1: '1 day',
              d365: '1 year',
            },
          },
          booking: {
            night: '{{count}} night',
            nights: '{{count}} nights',
          },
        },
      },
      true,
    );
    translate.use('en');
    return TestBed.createComponent(ListingDetailsPageComponent);
  }

  type Fixture = ReturnType<typeof setup>;

  function texts(fixture: Fixture, selector: string): string[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(selector)).map(
      (el) => el.textContent?.trim() ?? '',
    );
  }

  const tileLabels = (f: Fixture) => texts(f, '.detail-page__specquad-label');
  const pickupRowLabels = (f: Fixture) => texts(f, '.detail-page__pickup-row-label');
  const pickupRowValues = (f: Fixture) => texts(f, '.detail-page__pickup-row-value');

  it('has no highlights band', () => {
    const fixture = setup({
      hygieneNotes: 'Wiped',
      minRentalDays: 5,
      deliveryTypes: ['Pickup', 'Courier'],
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.detail-page__highlights'),
    ).toBeNull();
  });

  it('shows Age → Condition → Hygiene tiles when hygieneNotes is set', () => {
    const fixture = setup({ hygieneNotes: 'Wiped with disinfectant' });
    fixture.detectChanges();

    expect(tileLabels(fixture)).toEqual(['Recommended age', 'Condition', 'Hygiene notes']);
    expect(texts(fixture, '.detail-page__specquad-value').pop()).toBe(
      'Cleaning details from the owner',
    );
  });

  it.each([[null], ['   ']])('omits the Hygiene tile when hygieneNotes is %j', (notes) => {
    const fixture = setup({ hygieneNotes: notes });
    fixture.detectChanges();

    expect(tileLabels(fixture)).toEqual(['Recommended age', 'Condition']);
  });

  it('keeps Handover and Minimum rental out of the Details tiles', () => {
    const fixture = setup({
      hygieneNotes: 'Wiped',
      minRentalDays: 365,
      deliveryTypes: ['Pickup', 'Courier'],
    });
    fixture.detectChanges();

    expect(tileLabels(fixture)).not.toContain('Handover');
    expect(tileLabels(fixture)).not.toContain('Minimum rental');
  });

  it('shows Handover then Minimum rental beside the map, and no Hygiene row', () => {
    const fixture = setup({
      hygieneNotes: 'Wiped',
      minRentalDays: 365,
      deliveryTypes: ['Pickup', 'Courier'],
      deliveryType: 'Pickup',
    });
    fixture.detectChanges();

    expect(pickupRowLabels(fixture)).toEqual(['Handover', 'Minimum rental']);
    expect(pickupRowValues(fixture)).toEqual([
      'Free pickup or courier delivery in Yerevan',
      '1 year',
    ]);
  });

  it('renders the single-type handover hint when only legacy deliveryType is set', () => {
    const fixture = setup({ deliveryTypes: null, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowValues(fixture)[0]).toBe('Free · Meet at agreed spot');
  });

  it('shows a 1-day minimum rental row using the chip label', () => {
    const fixture = setup({ minRentalDays: 1, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowLabels(fixture)).toContain('Minimum rental');
    expect(pickupRowValues(fixture)).toContain('1 day');
  });

  it('falls back to the night count for a non-chip minimum rental', () => {
    const fixture = setup({ minRentalDays: 5, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowValues(fixture)).toContain('5 nights');
  });

  it('defaults a missing minRentalDays to the 1-day row (wizard default)', () => {
    const fixture = setup({ minRentalDays: null, deliveryType: 'Pickup' });
    fixture.detectChanges();

    expect(pickupRowLabels(fixture)).toContain('Minimum rental');
    expect(pickupRowValues(fixture)).toContain('1 day');
  });

  it('defaults missing delivery types to the Pickup row and always renders both rows', () => {
    const fixture = setup({ deliveryTypes: null, deliveryType: null, minRentalDays: null });
    fixture.detectChanges();

    expect(pickupRowLabels(fixture)).toEqual(['Handover', 'Minimum rental']);
    expect(pickupRowValues(fixture)).toEqual(['Free · Meet at agreed spot', '1 day']);
  });

  describe('location line', () => {
    const district = {
      id: 'd1',
      code: 'KEN',
      nameEn: 'Kentron',
      nameHy: 'Կենտրոն',
      nameRu: 'Кентрон',
    };

    function locationEl(fixture: Fixture, selector: string): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector(
        `.detail-page__meta-row ${selector}`,
      );
    }

    function clickWithMotionPreference(fixture: Fixture, reduce: boolean): void {
      const original = window.matchMedia;
      vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
      try {
        (locationEl(fixture, 'button') as HTMLButtonElement).click();
      } finally {
        vi.stubGlobal('matchMedia', original);
      }
    }

    it('shows "{district}, {city}" as a button when the listing has coordinates', () => {
      const fixture = setup({ district, latitude: 40.18, longitude: 44.51 });
      fixture.detectChanges();

      const btn = locationEl(fixture, 'button.detail-page__city') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.type).toBe('button');
      expect(btn.textContent?.trim()).toBe('Kentron, Yerevan');
      expect(btn.getAttribute('aria-label')).toBe('Show location on map: Kentron, Yerevan');
    });

    it('shows the city only when there is no district', () => {
      const fixture = setup({ district: null, latitude: 40.18, longitude: 44.51 });
      fixture.detectChanges();

      expect(locationEl(fixture, '.detail-page__city')?.textContent?.trim()).toBe('Yerevan');
    });

    it('renders plain text, not a button, when the listing has no coordinates', () => {
      const fixture = setup({ district, latitude: null, longitude: null });
      fixture.detectChanges();

      expect(locationEl(fixture, 'button')).toBeNull();
      expect(locationEl(fixture, 'span.detail-page__city')?.textContent?.trim()).toBe(
        'Kentron, Yerevan',
      );
    });

    it('smooth-scrolls to the pickup heading and focuses it on click', () => {
      const fixture = setup({ district, latitude: 40.18, longitude: 44.51 });
      fixture.detectChanges();
      const heading = (fixture.nativeElement as HTMLElement).querySelector(
        '#detail-pickup-heading',
      ) as HTMLElement;
      expect(heading.getAttribute('tabindex')).toBe('-1');
      heading.scrollIntoView = vi.fn();
      const focus = vi.spyOn(heading, 'focus');

      clickWithMotionPreference(fixture, false);

      expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(focus).toHaveBeenCalled();
    });

    it('scrolls instantly under prefers-reduced-motion', () => {
      const fixture = setup({ district, latitude: 40.18, longitude: 44.51 });
      fixture.detectChanges();
      const heading = (fixture.nativeElement as HTMLElement).querySelector(
        '#detail-pickup-heading',
      ) as HTMLElement;
      heading.scrollIntoView = vi.fn();

      clickWithMotionPreference(fixture, true);

      expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
    });
  });
});

/**
 * Loss & damage compensation (ADR-018, amended 2026-10-17): the renter meets
 * it once on the item page — in the protection card. The specs tile and the
 * pickup row are gone. The card decides "set vs. not specified" via
 * `isCompensationAmountSet` — finite number > 0. `0` gets its own case
 * because it's a real, reachable legacy value (the old optional-deposit
 * validator allowed it).
 */
describe('ListingDetailsPageComponent — loss & damage compensation amount', () => {
  function setup(compensationAmount: number | null) {
    const listing = makeListingDetails({
      id: 'listing-1',
      owner: { id: 'owner-1', firstName: 'Owen', lastName: 'Owner', isDeleted: false },
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

  function hasCompensationOutsideProtectionCard(fixture: ReturnType<typeof setup>): boolean {
    const root = fixture.nativeElement as HTMLElement;
    const cells = Array.from(
      root.querySelectorAll<HTMLElement>('.detail-page__specquad-cell, .detail-page__pickup-row'),
    );
    return cells.some((el) => /compensation|Not specified|Up to/.test(el.textContent ?? ''));
  }

  it('renders "Up to 45,000 ֏" only in the protection card, not in the specs quad or pickup rows', () => {
    const fixture = setup(45000);

    // The amount and the ֏ symbol are joined by a non-breaking space (see
    // `DramCurrencyPipe`), so the expected string uses ` ` there — a
    // plain space would never match the rendered `textContent`.
    expect(
      text(fixture, '.detail-page__protection-card--mobile .detail-page__protection-amount'),
    ).toBe('Up to 45,000 ֏');
    expect(hasCompensationOutsideProtectionCard(fixture)).toBe(false);
    expect(text(fixture, '.detail-page__specquad-value')).toBeUndefined();
  });

  it.each([
    ['null (never set)', null],
    ['0 (legacy data from the old optional-deposit validator)', 0],
  ])(
    'protection card renders "Not specified" and the no-amount intro when the amount is %s, and nothing else on the page repeats it',
    (_label, amount) => {
      const fixture = setup(amount);

      expect(
        text(fixture, '.detail-page__protection-card--mobile .detail-page__protection-amount'),
      ).toBe('Not specified');
      expect(
        text(fixture, '.detail-page__protection-card--mobile .detail-page__protection-intro'),
      ).toBe('The owner has not set an amount for this toy.');
      expect(hasCompensationOutsideProtectionCard(fixture)).toBe(false);
      expect(text(fixture, '.detail-page__specquad-value')).toBeUndefined();
    },
  );
});

describe('ListingDetailsPageComponent — section headings & review count', () => {
  function setup(reviewCount: number | null) {
    const listing = makeListingDetails({ id: 'listing-1' });
    const entry =
      reviewCount === null
        ? {}
        : {
            'listing-1': {
              data: {
                overallAverage: 4.5,
                reviewCount,
                hasAggregate: reviewCount > 0,
                distribution: [0, 0, 0, 0, reviewCount],
                comments: [],
              },
              isLoading: false,
              error: null,
            },
          };
    TestBed.configureTestingModule({
      imports: [ListingDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        MessageService,
        provideMockStore({
          initialState: {
            [listingsFeatureKey]: {
              ...initialListingsState,
              selectedListing: listing,
              isDetailsLoading: false,
            },
            [bookingsFeatureKey]: initialBookingsState,
            [reviewsFeatureKey]: { ...initialReviewsState, listingToyReviews: entry },
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
      { reviews: { summary: { countReviews: '{{count}} reviews' } } },
      true,
    );
    translate.use('en');
    const fixture = TestBed.createComponent(ListingDetailsPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders no section eyebrow labels', () => {
    const root = setup(null);
    expect(root.querySelector('.detail-page__section-eyebrow')).toBeNull();
  });

  it('shows the review count beside the reviews title, outside the h2', () => {
    const root = setup(3);
    const count = root.querySelector<HTMLElement>('.detail-page__section-count');
    expect(count?.textContent?.trim()).toBe('3 reviews');
    expect(root.querySelector('#detail-reviews-heading')?.textContent).not.toContain('3 reviews');
  });

  it('shows no count when there are no reviews', () => {
    const root = setup(0);
    expect(root.querySelector('.detail-page__section-count')).toBeNull();
  });
});
