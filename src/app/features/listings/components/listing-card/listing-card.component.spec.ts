import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { makeListingPreview } from '../../../../../testing/fixtures';
import type { ListingPreview } from '../../models/listing.model';
import type { ListingsOriginSource } from '../../models/listings-filter.model';
import { ListingCardComponent } from './listing-card.component';

/**
 * Distance-badge coverage for the home-point model (approved design section
 * (b)): the orange home-icon "{d} km from your home" pill, the blue
 * location-arrow "{d} km from you" one, and the rule that the viewer's OWN
 * listing never shows either.
 *
 * Built through `TestBed.createComponent`, not by calling the computeds in
 * isolation — M-028: a spec that never constructs the component cannot catch
 * a construction-time failure, and this component injects both
 * `LanguageService` (which itself needs `Store`) and `TranslateService`.
 */
function createCard(inputs: {
  listing?: Partial<ListingPreview>;
  distanceOrigin?: ListingsOriginSource | null;
  isOwner?: boolean;
}) {
  TestBed.configureTestingModule({
    imports: [ListingCardComponent, TranslateModule.forRoot()],
    providers: [provideRouter([]), provideMockStore({ initialState: {} })],
  });

  // The real i18n bundle isn't wired into unit tests, so load just the keys
  // asserted here — same pattern as listing-location.component.spec.ts.
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation(
    'en',
    {
      listings: {
        card: {
          distanceFromHome: '{{distance}} from your home',
          distanceFromYou: '{{distance}} from you',
          yourListing: 'Your listing',
        },
        filters: { distance: { unitMeters: 'm', unitKilometers: 'km' } },
      },
    },
    true,
  );
  translate.use('en');

  const fixture = TestBed.createComponent(ListingCardComponent);
  fixture.componentRef.setInput('listing', makeListingPreview(inputs.listing));
  fixture.componentRef.setInput('distanceOrigin', inputs.distanceOrigin ?? null);
  fixture.componentRef.setInput('isOwner', inputs.isOwner ?? false);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el };
}

function badge(el: HTMLElement): HTMLElement | null {
  return el.querySelector('.listing-card__distance-badge');
}

describe('ListingCardComponent — distance badge', () => {
  it('renders the home variant with the home icon when the origin is the home point', () => {
    const { el } = createCard({
      listing: { distanceKm: 2.4 },
      distanceOrigin: 'home',
    });

    const pill = badge(el);
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toContain('from your home');
    expect(pill!.classList.contains('listing-card__distance-badge--home')).toBe(true);
    expect(pill!.classList.contains('listing-card__distance-badge--live')).toBe(false);
    expect(pill!.querySelector('.pi-home')).not.toBeNull();
    expect(pill!.querySelector('.pi-compass')).toBeNull();
  });

  it('renders the live variant with the compass icon for a geolocation origin', () => {
    const { el } = createCard({
      listing: { distanceKm: 2.4 },
      distanceOrigin: 'geo',
    });

    const pill = badge(el);
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toContain('from you');
    expect(pill!.textContent).not.toContain('from your home');
    expect(pill!.classList.contains('listing-card__distance-badge--live')).toBe(true);
    expect(pill!.querySelector('.pi-compass')).not.toBeNull();
    expect(pill!.querySelector('.pi-home')).toBeNull();
  });

  it('renders the live variant for a manually picked origin', () => {
    const { el } = createCard({
      listing: { distanceKm: 1.1 },
      distanceOrigin: 'manual',
    });

    expect(badge(el)!.classList.contains('listing-card__distance-badge--live')).toBe(true);
  });

  // The product rule: no radius chosen means the API never computed a
  // distance, so there is nothing to render — the badge is not something the
  // client can synthesise from a home point it happens to know.
  it('renders no badge at all when the API returned no distance', () => {
    const { el } = createCard({ listing: { distanceKm: null }, distanceOrigin: 'home' });

    expect(badge(el)).toBeNull();
  });

  it('shows the owner badge and NO distance on the viewer’s own listing', () => {
    const { el } = createCard({
      listing: { distanceKm: 0.1 },
      distanceOrigin: 'home',
      isOwner: true,
    });

    expect(badge(el)).toBeNull();
    expect(el.querySelector('.listing-card__owner-badge')).not.toBeNull();
  });

  it('formats the distance through the shared locale-aware formatter', () => {
    const { el } = createCard({ listing: { distanceKm: 2.4 }, distanceOrigin: 'home' });

    // `formatDistanceMeters` renders kilometres with the translated unit.
    expect(badge(el)!.textContent).toContain('2.4 km');
  });

  it('falls back to the live wording when no origin source was supplied', () => {
    const { el } = createCard({ listing: { distanceKm: 2.4 } });

    const pill = badge(el);
    expect(pill!.classList.contains('listing-card__distance-badge--live')).toBe(true);
    expect(pill!.textContent).toContain('from you');
  });
});
