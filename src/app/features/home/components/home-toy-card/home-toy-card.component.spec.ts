import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { makeListingPreview } from '../../../../../testing/fixtures';
import { LanguageService } from '../../../../shared/services/language.service';
import type { ListingDistrict } from '../../../listings/models/district.model';
import type { ListingPreview } from '../../../listings/models/listing.model';
import { HomeToyCardComponent } from './home-toy-card.component';

const KENTRON: ListingDistrict = {
  id: 'd1',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

/**
 * Built through `TestBed.createComponent` (M-028): the card injects
 * `LanguageService`, which itself needs `Store`.
 */
function createCard(listing: Partial<ListingPreview> = {}, isOwner = false) {
  TestBed.configureTestingModule({
    imports: [HomeToyCardComponent, TranslateModule.forRoot()],
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
        card: { viewBtn: 'View', toggleFavorite: 'Save to favorites' },
        details: {
          conditionValues: { likeNew: 'Like new' },
          toyDetails: { ageRangeFromTo: '{{from}}–{{to}} months' },
        },
      },
      reviews: { summary: { noReviews: 'No reviews yet' } },
    },
    true,
  );
  translate.use('en');

  const fixture = TestBed.createComponent(HomeToyCardComponent);
  fixture.componentRef.setInput('listing', makeListingPreview(listing));
  fixture.componentRef.setInput('isOwner', isOwner);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el };
}

function text(el: HTMLElement, selector: string): string {
  return (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('HomeToyCardComponent', () => {
  describe('rating line', () => {
    it('shows the star, the rating to one decimal and the review count', () => {
      const { el } = createCard({ rating: 4.8, reviewCount: 12 });

      expect(el.querySelector('.tcard__star')).not.toBeNull();
      expect(text(el, '.tcard__rating-value')).toBe('4.8');
      expect(text(el, '.tcard__rating span')).toBe('(12)');
      expect(el.textContent).not.toContain('No reviews yet');
    });

    it('rounds a whole rating to one decimal', () => {
      const { el } = createCard({ rating: 5, reviewCount: 3 });

      expect(text(el, '.tcard__rating-value')).toBe('5.0');
    });

    it('shows "no reviews yet" and never a star when there is no rating', () => {
      const { el } = createCard({ rating: null, reviewCount: 0 });

      expect(el.querySelector('.tcard__star')).toBeNull();
      expect(text(el, '.tcard__line--hint')).toBe('No reviews yet');
    });

    it('treats a missing rating the same as null', () => {
      const { el } = createCard({ rating: undefined });

      expect(el.querySelector('.tcard__star')).toBeNull();
      expect(el.textContent).toContain('No reviews yet');
    });
  });

  describe('location line', () => {
    function locationFor(language: 'en' | 'hy' | 'ru', listing: Partial<ListingPreview>): string {
      const { fixture, el } = createCard(listing);
      const service = TestBed.inject(LanguageService);
      service.current.set(service.languages.find((l) => l.code === language)!);
      fixture.detectChanges();
      return text(el, '.tcard__ell');
    }

    it('renders "City, District" with the district in the UI language', () => {
      const listing = { city: 'Yerevan', district: KENTRON };

      expect(locationFor('en', listing)).toBe('Yerevan, Kentron');
    });

    it('uses the Russian district name in ru', () => {
      expect(locationFor('ru', { city: 'Ереван', district: KENTRON })).toBe('Ереван, Кентрон');
    });

    it('uses the Armenian district name in hy', () => {
      expect(locationFor('hy', { city: 'Երևան', district: KENTRON })).toBe('Երևան, Կենտրոն');
    });

    it('switches the district name live with the language', () => {
      const { fixture, el } = createCard({ city: 'Yerevan', district: KENTRON });
      const service = TestBed.inject(LanguageService);

      service.current.set(service.languages.find((l) => l.code === 'ru')!);
      fixture.detectChanges();
      expect(text(el, '.tcard__ell')).toBe('Yerevan, Кентрон');

      service.current.set(service.languages.find((l) => l.code === 'en')!);
      fixture.detectChanges();
      expect(text(el, '.tcard__ell')).toBe('Yerevan, Kentron');
    });

    it('falls back to the city alone when the district is null', () => {
      expect(locationFor('en', { city: 'Yerevan', district: null })).toBe('Yerevan');
    });

    it('falls back to the city alone when the district is absent', () => {
      expect(locationFor('en', { city: 'Yerevan' })).toBe('Yerevan');
    });
  });

  describe('price', () => {
    it('formats the amount through the dram pipe', () => {
      const { el } = createCard({ pricePerDay: 7000 });

      // ADR-019: a non-breaking space between amount and symbol.
      expect(el.querySelector('.tcard__price-amount')!.textContent).toBe('7,000 ֏');
    });

    it('uses the per-day suffix for a daily listing', () => {
      const { el } = createCard({ priceUnit: 'Daily' });

      expect(text(el, '.tcard__price-suffix')).toBe('per day');
    });

    it('falls back to the per-day suffix when the unit is undefined', () => {
      const { el } = createCard({ priceUnit: undefined });

      expect(text(el, '.tcard__price-suffix')).toBe('per day');
    });

    it('follows the price unit for weekly and monthly listings (ADR-047)', () => {
      expect(text(createCard({ priceUnit: 'Weekly' }).el, '.tcard__price-suffix')).toBe('/ week');
      TestBed.resetTestingModule();
      expect(text(createCard({ priceUnit: 'Monthly' }).el, '.tcard__price-suffix')).toBe('/ month');
    });
  });

  describe('favourite button', () => {
    it('is a button outside the link, with aria-pressed reflecting the state', () => {
      const { el } = createCard({ isFavorite: true });
      const fav = el.querySelector<HTMLButtonElement>('.tcard__fav')!;

      expect(fav).not.toBeNull();
      expect(fav.closest('a')).toBeNull();
      expect(fav.getAttribute('aria-pressed')).toBe('true');
      expect(fav.getAttribute('aria-label')).toBe('Save to favorites');
      expect(fav.querySelector('.pi-heart-fill')).not.toBeNull();
    });

    it('is not pressed for a toy that is not a favourite', () => {
      const { el } = createCard({ isFavorite: false });

      expect(el.querySelector('.tcard__fav')!.getAttribute('aria-pressed')).toBe('false');
    });

    it('emits the listing id when clicked, without following the card link', () => {
      const { fixture, el } = createCard({ id: 'toy-9' });
      const emitted: string[] = [];
      fixture.componentInstance.favoriteToggled.subscribe((id) => emitted.push(id));

      el.querySelector<HTMLButtonElement>('.tcard__fav')!.click();

      expect(emitted).toEqual(['toy-9']);
    });

    it('is hidden for the viewer’s own listing', () => {
      const { el } = createCard({}, true);

      expect(el.querySelector('.tcard__fav')).toBeNull();
    });
  });

  describe('link', () => {
    it('makes the title the whole-card link to the listing', () => {
      const { el } = createCard({ id: 'toy-9', title: 'Wooden Train Set' });
      const link = el.querySelector<HTMLAnchorElement>('.tcard__link')!;

      expect(link.textContent?.trim()).toBe('Wooden Train Set');
      expect(link.getAttribute('href')).toBe('/listings/toy-9');
    });

    it('links the owner to their own listing page', () => {
      const { el } = createCard({ id: 'toy-9' }, true);

      expect(el.querySelector('.tcard__link')!.getAttribute('href')).toBe('/my-listings/toy-9');
    });
  });

  describe('photo, age and condition', () => {
    it('shows the gift placeholder when there is no photo', () => {
      const { el } = createCard({ mainImageUrl: null });

      expect(el.querySelector('.tcard__img')).toBeNull();
      expect(el.querySelector('.tcard__nophoto .pi-gift')).not.toBeNull();
    });

    it('shows the photo when there is one', () => {
      const { el } = createCard({ mainImageUrl: '/uploads/a.jpg' });

      expect(el.querySelector('.tcard__nophoto')).toBeNull();
      expect(el.querySelector('.tcard__img')!.getAttribute('src')).toBe('/uploads/a.jpg');
    });

    it('renders the age pill through the shared age-range keys', () => {
      const { el } = createCard({ ageFromMonths: 6, ageToMonths: 18 });

      expect(text(el, '.tcard__age')).toBe('6–18 months');
    });

    it('omits the age pill when no age is known', () => {
      const { el } = createCard({ ageFromMonths: null, ageToMonths: null });

      expect(el.querySelector('.tcard__age')).toBeNull();
    });

    it('maps the condition through the canonical label keys (ADR-042)', () => {
      const { el } = createCard({ condition: 'Excellent' });

      expect(text(el, '.tcard__chip')).toBe('Like new');
    });

    it('omits the chip when there is no condition', () => {
      const { el } = createCard({ condition: null });

      expect(el.querySelector('.tcard__chip')).toBeNull();
    });

    it('always renders the decorative View pill (CSS shows it from 1024px)', () => {
      const { el } = createCard();
      const view = el.querySelector('.tcard__view')!;

      expect(view.textContent?.trim()).toBe('View');
      expect(view.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
