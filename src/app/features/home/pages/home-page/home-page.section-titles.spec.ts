import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import {
  selectListingCategories,
  selectListingCategoriesLoading,
} from '../../../listings/store/listings.selectors';
import { MyListingsApiService } from '../../../my-listings/services/my-listings-api.service';
import type { HomeSectionResponse } from '../../models/home-section.model';
import {
  selectHomeNearby,
  selectHomeSections,
  selectHomeSectionsError,
  selectHomeSectionsLoading,
} from '../../store/home.selectors';
import { initialHomeNearbyState } from '../../store/home.state';
import { HomePageComponent } from './home-page.component';

vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    on: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 40.1776, lng: 44.5126 })),
    getZoom: vi.fn(() => 14),
    getBounds: vi.fn(() => ({
      getNorth: () => 40.2,
      getSouth: () => 40.1,
      getEast: () => 44.6,
      getWest: () => 44.5,
    })),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn(), on: vi.fn() })),
  marker: vi.fn(() => ({ addTo: vi.fn(), getElement: vi.fn(() => null) })),
  circle: vi.fn(() => ({ addTo: vi.fn(), on: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

const item = {
  id: 'l1',
  title: 'Toy',
  city: 'Yerevan',
  pricePerDay: 1000,
  mainImageUrl: null,
  isFavorite: false,
};

function render(sections: HomeSectionResponse[]) {
  TestBed.configureTestingModule({
    imports: [HomePageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        selectors: [
          { selector: selectListingCategories, value: [] },
          { selector: selectListingCategoriesLoading, value: false },
          { selector: selectIsAuthenticated, value: false },
          { selector: selectHomeSections, value: sections },
          { selector: selectHomeSectionsLoading, value: false },
          { selector: selectHomeSectionsError, value: null },
          { selector: selectFavoriteIds, value: new Set<string>() },
          { selector: selectHomeNearby, value: initialHomeNearbyState },
        ],
      }),
      { provide: MyListingsApiService, useValue: { getMyListings: () => of([]) } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('hy', {
    home: { sections: { titles: { popular: 'Հանրաճանաչ խաղալիքներ' } } },
  });
  translate.use('hy');
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();
  return fixture;
}

function headingText(fixture: ReturnType<typeof render>, key: string): string {
  const el = (fixture.nativeElement as HTMLElement).querySelector(`#home-section-${key}`);
  return (el?.textContent ?? '').trim();
}

describe('HomePageComponent section titles', () => {
  it('shows the translated title for a known section key', () => {
    const fixture = render([{ key: 'popular', title: 'Popular Toys', items: [item] }]);
    expect(headingText(fixture, 'popular')).toBe('Հանրաճանաչ խաղալիքներ');
  });

  it('falls back to the server title for an unknown section key', () => {
    const fixture = render([{ key: 'brand-new', title: 'Brand New Toys', items: [item] }]);
    expect(headingText(fixture, 'brand-new')).toBe('Brand New Toys');
    expect(fixture.debugElement.query(By.css('#home-section-brand-new'))).toBeTruthy();
  });
});
