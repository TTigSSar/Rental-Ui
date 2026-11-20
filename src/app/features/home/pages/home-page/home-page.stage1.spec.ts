import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { makeListingPreview } from '../../../../../testing/fixtures';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import {
  selectListingCategories,
  selectListingCategoriesError,
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

interface RenderOptions {
  readonly sections?: HomeSectionResponse[];
  readonly loading?: boolean;
  readonly error?: string | null;
}

function render(options: RenderOptions = {}) {
  TestBed.configureTestingModule({
    imports: [HomePageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        selectors: [
          { selector: selectListingCategories, value: [] },
          { selector: selectListingCategoriesLoading, value: false },
          { selector: selectListingCategoriesError, value: null },
          { selector: selectIsAuthenticated, value: false },
          { selector: selectHomeSections, value: options.sections ?? [] },
          { selector: selectHomeSectionsLoading, value: options.loading ?? false },
          { selector: selectHomeSectionsError, value: options.error ?? null },
          { selector: selectFavoriteIds, value: new Set<string>() },
          { selector: selectHomeNearby, value: initialHomeNearbyState },
        ],
      }),
      { provide: MyListingsApiService, useValue: { getMyListings: () => of([]) } },
    ],
  });
  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('HomePageComponent hero search (Stage 1)', () => {
  it('has a round submit button with the search label, replacing the chevron', () => {
    const { el } = render();
    const submit = el.querySelector<HTMLButtonElement>('.home__hero-search-filter')!;

    expect(submit.type).toBe('submit');
    expect(submit.getAttribute('aria-label')).toBe('home.search.submit');
    expect(submit.querySelector('app-icon')).not.toBeNull();
    expect(submit.querySelector('.pi-chevron-right')).toBeNull();
  });

  it('keeps a leading search icon and the labelled input', () => {
    const { el } = render();

    expect(el.querySelector('.home__hero-search app-icon.home__hero-search-icon')).not.toBeNull();
    expect(el.querySelector('.home__hero-search-input')!.getAttribute('aria-label')).toBe(
      'home.search.ariaLabel',
    );
  });
});

describe('HomePageComponent toy rows (Stage 1)', () => {
  it('renders the shared listing card in the rows', () => {
    const { el } = render({
      sections: [{ key: 'popular', title: 'Popular', items: [makeListingPreview()] }],
    });

    expect(el.querySelectorAll('app-listing-card').length).toBe(1);
    expect(el.querySelector('app-home-toy-card')).toBeNull();
  });

  it('shows the five titled sections with card skeletons while loading', () => {
    const { el } = render({ loading: true });
    const sections = el.querySelectorAll('.home__section[aria-busy="true"]');

    expect(sections.length).toBe(5);
    expect(Array.from(sections).map((s) => s.querySelector('h2')!.id)).toEqual([
      'home-section-recent',
      'home-section-popular',
      'home-section-liked',
      'home-section-baby-toys',
      'home-section-outdoor-toys',
    ]);
    expect(el.querySelectorAll('app-listing-card-skeleton').length).toBe(25);
    expect(el.querySelector('app-ui-loading-skeleton')).toBeNull();
  });

  it('keeps the error state with a retry button', () => {
    const { el } = render({ error: 'boom' });

    expect(el.querySelector('.home__error[role="alert"]')).not.toBeNull();
    expect(el.querySelector('.home__error .home__error-retry')).not.toBeNull();
    expect(el.querySelector('app-home-toy-row')).toBeNull();
  });

  it('links "see all" to /listings', () => {
    const { el } = render({
      sections: [{ key: 'recent', title: 'Recent', items: [makeListingPreview()] }],
    });

    expect(el.querySelector('.home__section-action')!.getAttribute('href')).toBe('/listings');
  });
});

describe('HomePageComponent how it works (Stage 1)', () => {
  it('has a visible heading and a labelled tablist', () => {
    const { el } = render();
    const heading = el.querySelector('#home-process-heading')!;

    expect(heading.tagName).toBe('H2');
    expect(heading.classList.contains('home__sr-only')).toBe(false);
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe(
      'home.process.title',
    );
  });

  it('selects Renting by default and switches to Listing, keeping aria-selected in step', () => {
    const { fixture, el } = render();
    const [renting, lending] = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

    expect(renting.getAttribute('aria-selected')).toBe('true');
    expect(lending.getAttribute('aria-selected')).toBe('false');
    expect(el.querySelector('.home__process-step-title')!.textContent).toContain(
      'home.process.renting.step1.title',
    );

    lending.click();
    fixture.detectChanges();

    expect(renting.getAttribute('aria-selected')).toBe('false');
    expect(lending.getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(
      'home-process-tab-lending',
    );
    expect(el.querySelector('.home__process-step-title')!.textContent).toContain(
      'home.process.lending.step1.title',
    );
  });

  it('lists five renting steps with a connector after every step but the last', () => {
    const { el } = render();

    expect(el.querySelectorAll('.home__process-step').length).toBe(5);
    expect(el.querySelectorAll('.home__process-step-line').length).toBe(4);
    expect(
      Array.from(el.querySelectorAll('.home__process-step-icon i')).map((i) => i.className),
    ).toEqual([
      'pi pi-user',
      'pi pi-search',
      'pi pi-calendar',
      'pi pi-check',
      'pi pi-clock',
    ]);
  });
});
