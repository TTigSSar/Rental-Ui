import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { HeaderSearchVisibilityService } from '../../../../shared/ui/app-header/header-search-visibility.service';
import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../../favorites/store/favorites.selectors';
import {
  selectListingCategories,
  selectListingCategoriesLoading,
} from '../../../listings/store/listings.selectors';
import { MyListingsApiService } from '../../../my-listings/services/my-listings-api.service';
import {
  selectHomeSections,
  selectHomeSectionsError,
  selectHomeSectionsLoading,
} from '../../store/home.selectors';
import { HomePageComponent } from './home-page.component';

function createFixture() {
  TestBed.configureTestingModule({
    imports: [HomePageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        selectors: [
          { selector: selectListingCategories, value: [] },
          { selector: selectListingCategoriesLoading, value: false },
          { selector: selectIsAuthenticated, value: false },
          { selector: selectHomeSections, value: [] },
          { selector: selectHomeSectionsLoading, value: false },
          { selector: selectHomeSectionsError, value: null },
          { selector: selectFavoriteIds, value: new Set<string>() },
        ],
      }),
      { provide: MyListingsApiService, useValue: { getMyListings: () => of([]) } },
    ],
  });

  const fixture = TestBed.createComponent(HomePageComponent);
  fixture.detectChanges();

  return fixture;
}

/**
 * The mobile counterpart of the header search pill. The app-header is
 * display:none below 960px, so Home renders its own bar — but both surfaces
 * read the SAME HeaderSearchVisibilityService flag, written by the one hero
 * IntersectionObserver. These tests pin that single-mechanism contract.
 */
describe('HomePageComponent mobile revealed search', () => {
  it('renders a search bar with no filter control', () => {
    const host: HTMLElement = createFixture().nativeElement;
    const bar = host.querySelector('.home__mobile-search');

    expect(bar).not.toBeNull();
    expect(bar!.querySelector('app-ui-input')).not.toBeNull();
    // /listings pairs its mobile search with a filter button; Home must not.
    expect(bar!.querySelector('.lf-bar__filter-btn')).toBeNull();
    expect(bar!.querySelector('button')).toBeNull();
  });

  it('stays hidden and inert while the hero search is on screen', () => {
    const fixture = createFixture();
    TestBed.inject(HeaderSearchVisibilityService).setHidden(true);
    fixture.detectChanges();

    const bar = (fixture.nativeElement as HTMLElement).querySelector(
      '.home__mobile-search',
    )!;

    expect(bar.classList.contains('home__mobile-search--revealed')).toBe(false);
    expect(bar.hasAttribute('inert')).toBe(true);
  });

  it('reveals and becomes focusable once the hero search scrolls away', () => {
    const fixture = createFixture();
    const visibility = TestBed.inject(HeaderSearchVisibilityService);

    visibility.setHidden(true);
    fixture.detectChanges();

    visibility.setHidden(false);
    fixture.detectChanges();

    const bar = (fixture.nativeElement as HTMLElement).querySelector(
      '.home__mobile-search',
    )!;

    expect(bar.classList.contains('home__mobile-search--revealed')).toBe(true);
    expect(bar.hasAttribute('inert')).toBe(false);
  });

  it('shares the hero search control, so a typed query survives the reveal', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance as unknown as {
      searchForm: { controls: { query: { value: string; setValue(v: string): void } } };
    };

    component.searchForm.controls.query.setValue('lego');
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '.home__mobile-search input',
    )!;

    expect(input.value).toBe('lego');
  });
});
