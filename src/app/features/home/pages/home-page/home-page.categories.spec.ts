import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import type { ListingCategoryOption } from '../../../listings/models/create-listing.model';
import {
  selectListingCategories,
  selectListingCategoriesError,
  selectListingCategoriesLoading,
} from '../../../listings/store/listings.selectors';
import * as ListingsActions from '../../../listings/store/listings.actions';
import { MyListingsApiService } from '../../../my-listings/services/my-listings-api.service';
import {
  selectHomeNearby,
  selectHomeSections,
  selectHomeSectionsError,
  selectHomeSectionsLoading,
} from '../../store/home.selectors';
import { initialHomeNearbyState } from '../../store/home.state';
import { CategoryTileComponent } from '../../components/category-tile/category-tile.component';
import {
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from '../../../../shared/utils/category-palette.model';
import { HomePageComponent } from './home-page.component';

/**
 * Same minimal leaflet stub as `home-page.mobile-search.spec.ts` — these
 * assertions are all about the category tiles, not the hero map, but Home
 * still mounts `app-home-hero-map` -> `app-map` on init.
 */
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

interface FixtureOptions {
  readonly loading?: boolean;
  readonly error?: string | null;
}

function createFixture(categories: ListingCategoryOption[], options: FixtureOptions = {}) {
  TestBed.configureTestingModule({
    imports: [HomePageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        selectors: [
          { selector: selectListingCategories, value: categories },
          { selector: selectListingCategoriesLoading, value: options.loading ?? false },
          { selector: selectListingCategoriesError, value: options.error ?? null },
          { selector: selectIsAuthenticated, value: false },
          { selector: selectHomeSections, value: [] },
          { selector: selectHomeSectionsLoading, value: false },
          { selector: selectHomeSectionsError, value: null },
          { selector: selectFavoriteIds, value: new Set<string>() },
          { selector: selectHomeNearby, value: initialHomeNearbyState },
        ],
      }),
      { provide: MyListingsApiService, useValue: { getMyListings: () => of([]) } },
    ],
  });

  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();

  return fixture;
}

function tileVm(fixture: ReturnType<typeof createFixture>, index = 0) {
  const tiles = fixture.debugElement.queryAll(By.directive(CategoryTileComponent));
  return (tiles[index].componentInstance as CategoryTileComponent).category();
}

describe('HomePageComponent category tile mapping', () => {
  it('carries the admin-picked icon and colour through to the tile', () => {
    const fixture = createFixture([
      { id: 'cat-1', name: 'Ride-ons', slug: 'ride-ons', iconName: 'truck', colorHex: '#D9E8FF' },
    ]);

    const vm = tileVm(fixture);
    expect(vm.iconName).toBe('truck');
    expect(vm.colorHex).toBe('#D9E8FF');
  });

  it('falls back to the default icon when iconName is null', () => {
    const fixture = createFixture([
      { id: 'cat-1', name: 'Ride-ons', slug: 'ride-ons', iconName: null, colorHex: '#D9E8FF' },
    ]);

    expect(tileVm(fixture).iconName).toBe(DEFAULT_CATEGORY_ICON);
  });

  it('falls back to the default colour when colorHex is null', () => {
    const fixture = createFixture([
      { id: 'cat-1', name: 'Ride-ons', slug: 'ride-ons', iconName: 'truck', colorHex: null },
    ]);

    expect(tileVm(fixture).colorHex).toBe(DEFAULT_CATEGORY_COLOR);
  });

  it('no longer references imageUrl on the tile view model', () => {
    const fixture = createFixture([
      {
        id: 'cat-1',
        name: 'Ride-ons',
        slug: 'ride-ons',
        iconName: 'truck',
        colorHex: '#D9E8FF',
        imageUrl: '/assets/categories/ride-ons.svg',
      },
    ]);

    expect((tileVm(fixture) as unknown as { imageUrl?: unknown }).imageUrl).toBeUndefined();
  });
});

describe('HomePageComponent categories states', () => {
  const CATEGORY: ListingCategoryOption = {
    id: 'cat-1',
    name: 'Ride-ons',
    slug: 'ride-ons',
    iconName: 'truck',
    colorHex: '#D9E8FF',
  };

  function host(fixture: ReturnType<typeof createFixture>): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the error card with retry — not the empty copy — when the request failed', () => {
    const fixture = createFixture([], { error: 'boom' });

    expect(host(fixture).querySelector('.cats__card--error')).not.toBeNull();
    expect(host(fixture).querySelector('.cats__card--error')!.getAttribute('role')).toBe('alert');
    expect(host(fixture).querySelector('.cats__retry')).not.toBeNull();
    expect(host(fixture).querySelector('.cats__card--empty')).toBeNull();
  });

  it('shows the neutral empty card, with no action, when there are no categories and no error', () => {
    const fixture = createFixture([]);

    expect(host(fixture).querySelector('.cats__card--empty')).not.toBeNull();
    expect(host(fixture).querySelector('.cats__card--empty button')).toBeNull();
    expect(host(fixture).querySelector('.cats__card--error')).toBeNull();
  });

  it('dispatches the existing load action when "Try again" is pressed', () => {
    const fixture = createFixture([], { error: 'boom' });
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');

    host(fixture).querySelector<HTMLButtonElement>('.cats__retry')!.click();

    expect(dispatch).toHaveBeenCalledWith(ListingsActions.loadListingCategories());
  });

  it('shows a busy skeleton of 10 tiles while loading', () => {
    const fixture = createFixture([], { loading: true });

    expect(host(fixture).querySelectorAll('.cats__skel').length).toBe(10);
    expect(
      host(fixture).querySelector('.home__categories')!.getAttribute('aria-busy'),
    ).toBe('true');
  });

  it('gives each tile one button named by the category', () => {
    const fixture = createFixture([CATEGORY]);
    const buttons = host(fixture).querySelectorAll('.cats__track button');

    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent?.trim()).toBe('Ride-ons');
  });

  describe('scroller arrows', () => {
    function arrows(fixture: ReturnType<typeof createFixture>) {
      const [prev, next] = Array.from(
        host(fixture).querySelectorAll<HTMLButtonElement>('.cats__arrow'),
      );
      return { prev, next };
    }

    function setTrack(
      fixture: ReturnType<typeof createFixture>,
      metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number },
    ) {
      const track = host(fixture).querySelector<HTMLElement>('.cats__track')!;
      for (const [key, value] of Object.entries(metrics)) {
        Object.defineProperty(track, key, { configurable: true, value });
      }
      track.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
    }

    it('disables Previous at the start and Next at the end', () => {
      const fixture = createFixture([CATEGORY]);

      setTrack(fixture, { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 });
      expect(arrows(fixture).prev.getAttribute('aria-disabled')).toBe('true');
      expect(arrows(fixture).next.hasAttribute('aria-disabled')).toBe(false);

      setTrack(fixture, { scrollLeft: 300, clientWidth: 300, scrollWidth: 900 });
      expect(arrows(fixture).prev.hasAttribute('aria-disabled')).toBe(false);
      expect(arrows(fixture).next.hasAttribute('aria-disabled')).toBe(false);

      setTrack(fixture, { scrollLeft: 600, clientWidth: 300, scrollWidth: 900 });
      expect(arrows(fixture).prev.hasAttribute('aria-disabled')).toBe(false);
      expect(arrows(fixture).next.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not scroll when the pressed arrow is disabled', () => {
      const fixture = createFixture([CATEGORY]);
      const track = host(fixture).querySelector<HTMLElement>('.cats__track')!;
      const scrollTo = vi.fn();
      track.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];
      setTrack(fixture, { scrollLeft: 0, clientWidth: 300, scrollWidth: 900 });

      arrows(fixture).prev.click();

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
