import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { makeListingPreview } from '../../../../../testing/fixtures';
import { LanguageService } from '../../../../shared/services/language.service';
import type { BookingStatus } from '../../../bookings/models/booking.model';
import type { ListingDistrict } from '../../models/district.model';
import type { ListingPreview } from '../../models/listing.model';
import type { ListingsOriginSource } from '../../models/listings-filter.model';
import { ListingCardComponent } from './listing-card.component';

const KENTRON: ListingDistrict = {
  id: 'd1',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

interface CardInputs {
  listing?: Partial<ListingPreview>;
  isOwner?: boolean;
  isAuthenticated?: boolean;
  bookingStatus?: BookingStatus | null;
  distanceOrigin?: ListingsOriginSource | null;
}

/**
 * Built through `TestBed.createComponent` (M-028): the card injects
 * `LanguageService`, which itself needs `Store`, and `TranslateService`.
 */
function createCard(inputs: CardInputs = {}) {
  TestBed.configureTestingModule({
    imports: [ListingCardComponent, TranslateModule.forRoot()],
    providers: [provideRouter([]), provideMockStore({ initialState: {} })],
  });

  // Only the keys this spec asserts on; ngx-translate echoes the key otherwise.
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation(
    'en',
    {
      listings: {
        booking: { priceSuffix: 'per day' },
        createForm: { perUnit: { weekly: '/ week', monthly: '/ month' } },
        card: {
          viewBtn: 'View',
          toggleFavorite: 'Save to favorites',
          yourListing: 'Your listing',
          statusRented: 'Rented',
          distanceFromHome: '{{distance}} from your home',
          distanceFromYou: '{{distance}} from you',
          bookingBadge: { approved: 'Approved', rentalRequested: 'Rental requested' },
        },
        filters: { distance: { unitMeters: 'm', unitKilometers: 'km' } },
        details: {
          conditionValues: { likeNew: 'Like new' },
          toyDetails: { ageRangeFromTo: '{{from}}–{{to}} months' },
        },
      },
      reviews: {
        summary: { noReviews: 'No reviews yet', oneReview: '1 review', ariaRating: 'Rated {{rating}} out of 5' },
      },
    },
    true,
  );
  translate.use('en');

  const fixture = TestBed.createComponent(ListingCardComponent);
  fixture.componentRef.setInput('listing', makeListingPreview(inputs.listing));
  fixture.componentRef.setInput('isOwner', inputs.isOwner ?? false);
  fixture.componentRef.setInput('isAuthenticated', inputs.isAuthenticated ?? false);
  fixture.componentRef.setInput('bookingStatus', inputs.bookingStatus ?? undefined);
  fixture.componentRef.setInput('distanceOrigin', inputs.distanceOrigin ?? null);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el };
}

function text(el: HTMLElement, selector: string): string {
  return (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('ListingCardComponent', () => {
  describe('rating line', () => {
    it('shows the star, the rating to one decimal and the review count', () => {
      const { el } = createCard({ listing: { rating: 4.8, reviewCount: 12 } });

      expect(el.querySelector('.listing-card__star')).not.toBeNull();
      expect(text(el, '.listing-card__rating-value')).toBe('4.8');
      expect(text(el, '.listing-card__rating span')).toBe('(12)');
      expect(el.textContent).not.toContain('No reviews yet');
    });

    it('rounds a whole rating to one decimal', () => {
      const { el } = createCard({ listing: { rating: 5, reviewCount: 3 } });

      expect(text(el, '.listing-card__rating-value')).toBe('5.0');
    });

    it('shows "no reviews yet" and never a star when there is no rating (M-090)', () => {
      const { el } = createCard({ listing: { rating: null, reviewCount: 0 } });

      expect(el.querySelector('.listing-card__star')).toBeNull();
      expect(text(el, '.listing-card__line--hint')).toBe('No reviews yet');
    });

    it('shows "1 review" with no star and no number for exactly one review (ADR-014)', () => {
      const { el } = createCard({ listing: { rating: null, reviewCount: 1 } });

      expect(el.querySelector('.listing-card__star')).toBeNull();
      expect(text(el, '.listing-card__line--hint')).toBe('1 review');
      expect(el.textContent).not.toContain('No reviews yet');
    });

    it('labels the rating line for assistive tech', () => {
      const { el } = createCard({ listing: { rating: 4.8, reviewCount: 12 } });

      const rating = el.querySelector('.listing-card__rating');
      expect(rating?.getAttribute('aria-label')).toBe('Rated 4.8 out of 5');
      // aria-label is only valid on a role that can be named (a bare div is generic).
      expect(rating?.getAttribute('role')).toBe('img');
    });

    it('treats a missing rating the same as null', () => {
      const { el } = createCard({ listing: { rating: undefined } });

      expect(el.querySelector('.listing-card__star')).toBeNull();
      expect(el.textContent).toContain('No reviews yet');
    });
  });

  describe('location line', () => {
    function locationFor(language: 'en' | 'hy' | 'ru', listing: Partial<ListingPreview>): string {
      const { fixture, el } = createCard({ listing });
      const service = TestBed.inject(LanguageService);
      service.current.set(service.languages.find((l) => l.code === language)!);
      fixture.detectChanges();
      return text(el, '.listing-card__ell');
    }

    it('renders "City, District" with the district in the UI language', () => {
      expect(locationFor('en', { city: 'Yerevan', district: KENTRON })).toBe('Yerevan, Kentron');
    });

    it('uses the Russian district name in ru', () => {
      expect(locationFor('ru', { city: 'Ереван', district: KENTRON })).toBe('Ереван, Кентрон');
    });

    it('uses the Armenian district name in hy', () => {
      expect(locationFor('hy', { city: 'Երևան', district: KENTRON })).toBe('Երևան, Կենտրոն');
    });

    it('switches the district name live with the language', () => {
      const { fixture, el } = createCard({ listing: { city: 'Yerevan', district: KENTRON } });
      const service = TestBed.inject(LanguageService);

      service.current.set(service.languages.find((l) => l.code === 'ru')!);
      fixture.detectChanges();
      expect(text(el, '.listing-card__ell')).toBe('Yerevan, Кентрон');

      service.current.set(service.languages.find((l) => l.code === 'en')!);
      fixture.detectChanges();
      expect(text(el, '.listing-card__ell')).toBe('Yerevan, Kentron');
    });

    it('falls back to the city alone when the district is null or absent', () => {
      expect(locationFor('en', { city: 'Yerevan', district: null })).toBe('Yerevan');
      TestBed.resetTestingModule();
      expect(locationFor('en', { city: 'Yerevan' })).toBe('Yerevan');
    });
  });

  describe('distance suffix', () => {
    it('appends the formatted distance to the location line', () => {
      const { el } = createCard({
        listing: { city: 'Yerevan', district: KENTRON, distanceKm: 1.2 },
        distanceOrigin: 'home',
      });

      expect(text(el, '.listing-card__ell')).toBe('Yerevan, Kentron');
      expect(text(el, '.listing-card__distance')).toBe('· 1.2 km');
    });

    it('words the tooltip by origin: home vs live', () => {
      const home = createCard({ listing: { distanceKm: 2.4 }, distanceOrigin: 'home' });
      expect(home.el.querySelector('.listing-card__distance')!.getAttribute('title')).toBe(
        '2.4 km from your home',
      );
      TestBed.resetTestingModule();
      const geo = createCard({ listing: { distanceKm: 2.4 }, distanceOrigin: 'geo' });
      expect(geo.el.querySelector('.listing-card__distance')!.getAttribute('title')).toBe(
        '2.4 km from you',
      );
    });

    it('shows no suffix when the API returned no distance', () => {
      const { el } = createCard({ listing: { distanceKm: null }, distanceOrigin: 'home' });

      expect(el.querySelector('.listing-card__distance')).toBeNull();
    });

    it('shows no suffix on the viewer’s own listing', () => {
      const { el } = createCard({ listing: { distanceKm: 0.1 }, distanceOrigin: 'home', isOwner: true });

      expect(el.querySelector('.listing-card__distance')).toBeNull();
    });
  });

  describe('owner and booking pill', () => {
    it('shows the owner pill, top-left, on the viewer’s own listing', () => {
      const { el } = createCard({ isOwner: true });
      const pill = el.querySelector('.listing-card__badge')!;

      expect(pill.textContent?.trim()).toBe('Your listing');
      expect(pill.classList.contains('listing-card__badge--owner')).toBe(true);
      expect(pill.closest('.listing-card__media')).not.toBeNull();
    });

    it('shows the booking status pill for a signed-in viewer', () => {
      const { el } = createCard({ isAuthenticated: true, bookingStatus: 'Approved' });
      const pill = el.querySelector('.listing-card__badge')!;

      expect(pill.textContent?.trim()).toBe('Approved');
      expect(pill.classList.contains('listing-card__badge--booking')).toBe(true);
    });

    it('lets the owner pill win over a booking status, with exactly one pill', () => {
      const { el } = createCard({
        isOwner: true,
        isAuthenticated: true,
        bookingStatus: 'Approved',
      });

      expect(el.querySelectorAll('.listing-card__badge').length).toBe(1);
      expect(text(el, '.listing-card__badge')).toBe('Your listing');
    });

    it('shows a Rented pill for a rented listing', () => {
      const { el } = createCard({ listing: { listingStatus: 'rented' } });

      expect(el.querySelectorAll('.listing-card__badge').length).toBe(1);
      expect(text(el, '.listing-card__badge')).toBe('Rented');
    });

    it('shows no pill for an available listing', () => {
      const { el } = createCard({ listing: { listingStatus: 'available' } });

      expect(el.querySelector('.listing-card__badge')).toBeNull();
    });

    it('lets Rented beat owner and booking, with exactly one pill', () => {
      const { el } = createCard({
        listing: { listingStatus: 'rented' },
        isOwner: true,
        isAuthenticated: true,
        bookingStatus: 'Approved',
      });

      expect(el.querySelectorAll('.listing-card__badge').length).toBe(1);
      expect(text(el, '.listing-card__badge')).toBe('Rented');
    });

    it('hides the booking pill when signed out', () => {
      const { el } = createCard({ isAuthenticated: false, bookingStatus: 'Approved' });

      expect(el.querySelector('.listing-card__badge')).toBeNull();
    });

    it('has no pill without an owner flag or a booking status', () => {
      const { el } = createCard({ isAuthenticated: true });

      expect(el.querySelector('.listing-card__badge')).toBeNull();
    });
  });

  describe('price', () => {
    it('formats the amount through the dram pipe', () => {
      const { el } = createCard({ listing: { pricePerDay: 7000 } });

      // ADR-019: a non-breaking space between amount and symbol.
      expect(el.querySelector('.listing-card__price-amount')!.textContent).toBe('7,000 ֏');
    });

    it('uses the per-day suffix for a daily listing and an undefined unit', () => {
      expect(text(createCard({ listing: { priceUnit: 'Daily' } }).el, '.listing-card__price-suffix')).toBe(
        'per day',
      );
      TestBed.resetTestingModule();
      expect(
        text(createCard({ listing: { priceUnit: undefined } }).el, '.listing-card__price-suffix'),
      ).toBe('per day');
    });

    it('follows the price unit for weekly and monthly listings (ADR-047)', () => {
      expect(text(createCard({ listing: { priceUnit: 'Weekly' } }).el, '.listing-card__price-suffix')).toBe(
        '/ week',
      );
      TestBed.resetTestingModule();
      expect(
        text(createCard({ listing: { priceUnit: 'Monthly' } }).el, '.listing-card__price-suffix'),
      ).toBe('/ month');
    });
  });

  describe('favourite button', () => {
    it('is a button outside the link, with aria-pressed reflecting the state', () => {
      const { el } = createCard({ listing: { isFavorite: true } });
      const fav = el.querySelector<HTMLButtonElement>('.listing-card__fav-btn')!;

      expect(fav.closest('a')).toBeNull();
      expect(fav.getAttribute('aria-pressed')).toBe('true');
      expect(fav.getAttribute('aria-label')).toBe('Save to favorites');
      expect(fav.querySelector('.pi-heart-fill')).not.toBeNull();
    });

    it('is not pressed for a toy that is not a favourite', () => {
      const { el } = createCard({ listing: { isFavorite: false } });

      expect(el.querySelector('.listing-card__fav-btn')!.getAttribute('aria-pressed')).toBe('false');
    });

    it('emits the listing id when clicked', () => {
      const { fixture, el } = createCard({ listing: { id: 'toy-9' } });
      const emitted: string[] = [];
      fixture.componentInstance.favoriteToggled.subscribe((id) => emitted.push(id));

      el.querySelector<HTMLButtonElement>('.listing-card__fav-btn')!.click();

      expect(emitted).toEqual(['toy-9']);
    });

    it('is hidden for the viewer’s own listing', () => {
      const { el } = createCard({ isOwner: true });

      expect(el.querySelector('.listing-card__fav-btn')).toBeNull();
    });
  });

  describe('link', () => {
    it('makes the title the whole-card link to the listing', () => {
      const { el } = createCard({ listing: { id: 'toy-9', title: 'Wooden Train Set' } });
      const link = el.querySelector<HTMLAnchorElement>('.listing-card__link')!;

      expect(link.textContent?.trim()).toBe('Wooden Train Set');
      expect(link.getAttribute('href')).toBe('/listings/toy-9');
    });

    it('links the owner to their own listing page', () => {
      const { el } = createCard({ listing: { id: 'toy-9' }, isOwner: true });

      expect(el.querySelector('.listing-card__link')!.getAttribute('href')).toBe('/my-listings/toy-9');
    });
  });

  describe('photo, age, condition and View pill', () => {
    it('shows the gift placeholder when there is no photo', () => {
      const { el } = createCard({ listing: { mainImageUrl: null } });

      expect(el.querySelector('.listing-card__img')).toBeNull();
      expect(el.querySelector('.listing-card__nophoto .pi-gift')).not.toBeNull();
    });

    it('shows the photo when there is one', () => {
      const { el } = createCard({ listing: { mainImageUrl: '/uploads/a.jpg' } });

      expect(el.querySelector('.listing-card__nophoto')).toBeNull();
      expect(el.querySelector('.listing-card__img')!.getAttribute('src')).toBe('/uploads/a.jpg');
    });

    it('renders the age pill through the shared age-range keys, and omits it without an age', () => {
      expect(
        text(createCard({ listing: { ageFromMonths: 6, ageToMonths: 18 } }).el, '.listing-card__age'),
      ).toBe('6–18 months');
      TestBed.resetTestingModule();
      expect(
        createCard({ listing: { ageFromMonths: null, ageToMonths: null } }).el.querySelector(
          '.listing-card__age',
        ),
      ).toBeNull();
    });

    it('maps the condition through the canonical label keys (ADR-042)', () => {
      const { el } = createCard({ listing: { condition: 'Excellent' } });

      expect(text(el, '.listing-card__chip')).toBe('Like new');
    });

    it('omits the chip when there is no condition', () => {
      const { el } = createCard({ listing: { condition: null } });

      expect(el.querySelector('.listing-card__chip')).toBeNull();
    });

    // The pill is always in the DOM; the stylesheet shows it only from 1024px
    // (`@media (min-width: 1024px)`), so there is no JS viewport branch.
    it('renders the decorative View pill, shown by CSS on desktop only', () => {
      const { el } = createCard();
      const view = el.querySelector('.listing-card__view')!;

      expect(view.textContent?.trim()).toBe('View');
      expect(view.getAttribute('aria-hidden')).toBe('true');

      // The compiled component stylesheet (jsdom does not evaluate media queries).
      const css = (
        ListingCardComponent as unknown as { ɵcmp: { styles: string[] } }
      ).ɵcmp.styles.join(' ');
      // Hidden by default, then switched on inside the >= 1024px media query.
      expect(css).toMatch(/\.listing-card__view\S*\s*\{[^}]*display:\s*none/);
      expect(css).toMatch(
        /@media \(min-width: 1024px\)\s*\{[^@]*\.listing-card__view\S*\s*\{[^}]*display:\s*inline-flex/,
      );
    });
  });
});
