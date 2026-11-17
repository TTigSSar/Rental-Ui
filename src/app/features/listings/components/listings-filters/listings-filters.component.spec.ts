import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of } from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import { ListingsApiService } from '../../services/listings-api.service';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingCategories,
  selectListingsAi,
  selectListingsOriginCoords,
  selectListingsOriginDenied,
  selectListingsOriginSource,
} from '../../store/listings.selectors';
import { initialListingsAiState } from '../../store/listings.state';
import { ListingsFiltersComponent } from './listings-filters.component';

/** Access to the sheet's protected surface without loosening it for production code. */
interface SheetAccess {
  applySheet(): void;
  clearSheet(): void;
  closeSheet(): void;
  openSheet(): void;
  openSheetAt(section: 'price' | 'districts'): void;
  onDraftRadiusMetersChange(meters: number): void;
  onDraftOriginCleared(): void;
  onDraftDistrictsCleared(): void;
  toggleDraftAge(value: string): void;
  toggleDraftCondition(value: string): void;
  onDraftCategoriesCleared(): void;
  removeChip(chip: { key: string; label: string; value?: string; districtId?: string }): void;
  readonly activeChips: () => ReadonlyArray<{
    key: string;
    label: string;
    value?: string;
    districtId?: string;
  }>;
  readonly draftForm: {
    getRawValue(): {
      city: string;
      categoryIds: string[];
      ageGroups: string[];
      conditions: string[];
      minPrice: number | null;
      maxPrice: number | null;
      radiusKm: number | null;
      districtIds: string[];
    };
    patchValue(value: Record<string, unknown>): void;
    readonly controls: {
      readonly districtIds: { setValue(value: unknown): void };
      readonly categoryIds: { setValue(value: unknown): void };
    };
  };
}

/**
 * Regression coverage for M-021: the mobile filter sheet used to navigate
 * with `queryParamsHandling: 'replace'` and a `toQueryParams()` that only
 * ever emitted its own six keys — so applying/clearing the sheet silently
 * stripped ANY param it had no concept of, known or not (confirmed live:
 * `/listings?ageGroups=0-12&maxDistance=5` at 375px, tap "Apply" with zero
 * changes, URL became a bare `/listings`). Fixed by switching to `'merge'`.
 *
 * The radius filter (Maps P2 "location + radius" design) changed WHICH keys
 * this form owns: `radiusKm` (renamed from the old discrete-km
 * `maxDistance`) is now one of THIS form's own fields — like `districtIds`,
 * both the desktop sidebar and this sheet read/write the exact same URL
 * param, so there is only ever one copy of that state to drift, not two
 * surfaces that could disagree. `ageGroup`, by contrast, is STILL
 * desktop-sidebar-only — this file keeps both scenarios apart so a future
 * change can't quietly re-introduce the M-021 shape by giving the sheet a
 * field it silently doesn't round-trip.
 */
async function navigateToListings(
  url: string,
  // Loaded BEFORE the first `harness.detectChanges()` so the `activeChips`
  // computed's initial evaluation (triggered by the template's chip row)
  // already sees these strings — setting them afterwards would be silently
  // ignored, since `computed()` only re-runs when one of ITS OWN tracked
  // signals changes, and `translate.instant()` isn't one (same idiom as
  // `listing-details-page.component.spec.ts`'s `setTranslation` calls).
  options?: { translations?: TranslationObject; categories?: ListingCategoryOption[] },
): Promise<{
  component: ListingsFiltersComponent & SheetAccess;
  router: Router;
  store: MockStore;
}> {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([{ path: 'listings', component: ListingsFiltersComponent }]),
      provideMockStore({
        selectors: [
          { selector: selectListingCategories, value: options?.categories ?? [] },
          { selector: selectListingsAi, value: initialListingsAiState },
          { selector: selectListingsOriginCoords, value: null },
          { selector: selectListingsOriginSource, value: null },
          { selector: selectListingsOriginDenied, value: false },
        ],
      }),
      { provide: ListingsApiService, useValue: { getDistricts: () => of([]) } },
    ],
    teardown: { destroyAfterEach: true },
  });

  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');

  if (options?.translations) {
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', options.translations, true);
    translate.use('en');
  }

  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(url, ListingsFiltersComponent);
  harness.detectChanges();

  return {
    component: component as unknown as ListingsFiltersComponent & SheetAccess,
    router: TestBed.inject(Router),
    store,
  };
}

describe('ListingsFiltersComponent — cross-surface query param preservation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('tapping Apply with no changes preserves ageGroups AND radiusKm (both sheet-owned, round-tripped unchanged)', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroups=0-12&radiusKm=5',
    );

    component.openSheet();
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350); // flush the form's debounceTime(300)

    expect(router.url).toBe('/listings?ageGroups=0-12&radiusKm=5');
  });

  it('tapping Clear resets the sheet-owned radiusKm and ageGroup (the sheet owns age since AI search) but keeps unknown params', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroups=0-12&radiusKm=5&view=map',
    );

    component.openSheet();
    component.clearSheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).not.toContain('ageGroups=');
    expect(url).not.toContain('radiusKm=');
    expect(url).toContain('view=map');
  });

  it('applying a sheet-owned filter (city) still merges in alongside ageGroup and an existing radiusKm', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroups=0-12&radiusKm=5',
    );

    component.openSheet();
    component.draftForm.patchValue({ city: 'Yerevan' });
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('ageGroups=0-12');
    expect(url).toContain('radiusKm=5');
    expect(url).toContain('city=Yerevan');
  });

  it('clearing a sheet-owned filter actually removes its own param from the URL (merge still deletes what it owns)', async () => {
    const { component, router } = await navigateToListings(
      '/listings?view=map&radiusKm=5&city=Yerevan&categoryIds=abc&ageGroups=0-12',
    );

    component.openSheet();
    component.clearSheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    // Sheet-owned filters actually cleared out of the URL...
    expect(url).not.toContain('city=');
    expect(url).not.toContain('categoryIds=');
    expect(url).not.toContain('radiusKm=');
    expect(url).not.toContain('ageGroups=');
    // ...while a param the sheet doesn't know about survives untouched.
    expect(url).toContain('view=map');
  });

  it("the sheet's Child's age pills write ageGroup to the URL on Apply, and tapping the active pill clears it", async () => {
    const { component, router } = await navigateToListings('/listings');

    component.openSheet();
    component.toggleDraftAge('36-72');
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);
    expect(router.url).toContain('ageGroups=36-72');

    component.openSheet();
    component.toggleDraftAge('36-72');
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);
    expect(router.url).not.toContain('ageGroups=');
  });

  it('an age set from the URL (e.g. by the AI search) counts as an active chip for the filter-button badge', async () => {
    const { component } = await navigateToListings('/listings?ageGroups=12-36');

    expect(component.activeChips().map((c) => c.key)).toContain('ageGroup');
  });

  it('adjusting the radius in the sheet and applying commits the new value to the URL, merged with ageGroup', async () => {
    const { component, router } = await navigateToListings('/listings?ageGroups=0-12');

    component.openSheet();
    component.onDraftRadiusMetersChange(3000); // 3 km
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('ageGroups=0-12');
    expect(url).toContain('radiusKm=3');
  });

  it('closing the sheet without applying (Cancel) never touches the URL at all', async () => {
    const { component, router } = await navigateToListings('/listings?ageGroups=0-12&radiusKm=5');

    component.openSheet();
    component.onDraftRadiusMetersChange(10000); // 10 km, drafted but not applied
    component.closeSheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).toBe('/listings?ageGroups=0-12&radiusKm=5');
  });
});

/**
 * Trello #80: the origin (reference point) had no clear path at all. This
 * sheet's own commit for it is deliberately NOT staged like the rest of the
 * draft — see `onDraftOriginCleared()`'s doc comment for why an origin
 * removal commits immediately instead of waiting for "Apply".
 */
describe('ListingsFiltersComponent — clearing the origin (Trello #80)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('onDraftOriginCleared() nulls the draft AND immediately removes radiusKm from the URL', async () => {
    const { component, router } = await navigateToListings('/listings?ageGroups=0-12&radiusKm=5');

    component.openSheet();
    component.onDraftOriginCleared();
    await vi.advanceTimersByTimeAsync(350);

    expect(component.draftForm.getRawValue().radiusKm).toBeNull();
    const url = router.url;
    expect(url).not.toContain('radiusKm=');
    // The age list still survives the merge-navigate.
    expect(url).toContain('ageGroups=0-12');
  });

  it('onDraftOriginCleared() commits even if the sheet is then cancelled (no inert radiusKm left behind)', async () => {
    const { component, router } = await navigateToListings('/listings?radiusKm=5');

    component.openSheet();
    component.onDraftOriginCleared();
    component.closeSheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).not.toContain('radiusKm=');
  });

  it('clearSheet() dispatches clearOrigin', async () => {
    const { component, store } = await navigateToListings('/listings?radiusKm=5');

    component.openSheet();
    component.clearSheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(store.dispatch).toHaveBeenCalledWith(ListingsActions.clearOrigin());
  });

  it("removeChip()'s radiusKm case dispatches clearOrigin and removes radiusKm from the URL", async () => {
    const { component, router, store } = await navigateToListings('/listings?radiusKm=5');

    component.removeChip({ key: 'radiusKm', label: '5 km · from you' });
    await vi.advanceTimersByTimeAsync(350);

    expect(store.dispatch).toHaveBeenCalledWith(ListingsActions.clearOrigin());
    expect(router.url).not.toContain('radiusKm=');
  });
});

/**
 * Follow-up fix (code review, post-Trello #80): PrimeNG 21.1.6's
 * `MultiSelect.clear()` calls `updateModel(null, event)` BEFORE it emits
 * `onClear` — so the districts field's "×" writes a raw `null` into
 * `draftForm.controls.districtIds` (typed `string[]`, nonNullable) for one
 * tick. Left alone, that `null` reached `applySheet()` → `filterForm` →
 * `serializeDistrictIdsParam(null)`, which throws, so the navigation never
 * ran, and `activeChips`/`hasSheetFilters` (which iterate/read `.length` on
 * the value) threw too. Fixed two ways: `(onClear)` normalizes the control
 * back to `[]` immediately, and `applySheet()` defensively falls back to
 * `[]` for whatever reaches it. These tests simulate PrimeNG's null write
 * directly (bypassing the form's own `string[]` typing, the same way
 * PrimeNG's `ControlValueAccessor.writeValue` would) rather than driving
 * the real `p-multiSelect`, since the defect is in what value crosses the
 * form boundary, not how the click reaches PrimeNG's internals.
 */
describe('ListingsFiltersComponent — districts multiselect clear (PrimeNG null-before-onClear)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('onDraftDistrictsCleared() sets the draft control to []', async () => {
    const { component } = await navigateToListings('/listings?districtIds=d1,d2');

    component.openSheet();
    component.draftForm.controls.districtIds.setValue(null); // simulates PrimeNG's pre-onClear write
    component.onDraftDistrictsCleared();

    expect(component.draftForm.getRawValue().districtIds).toEqual([]);
  });

  it('applySheet() with a null districtIds draft (PrimeNG clear before onClear fires) does not throw, drops districtIds from the URL, and preserves other params', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroups=0-12&districtIds=d1,d2',
    );

    component.openSheet();
    component.draftForm.controls.districtIds.setValue(null);

    expect(() => component.applySheet()).not.toThrow();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).not.toContain('districtIds=');
    expect(url).toContain('ageGroups=0-12');
  });
});

/**
 * The price chips used to be raw hardcoded English (`Min ${v.minPrice}` /
 * `Max ${v.maxPrice}`) with no currency symbol or grouping — the only
 * price-related strings in the UI that bypassed both `DramCurrencyPipe` and
 * ngx-translate. Now routed through `listings.filters.chips.minPrice` /
 * `.maxPrice` with a pre-formatted `amount` param, mirroring the
 * `radiusKm` chip's existing `translate.instant()` pattern.
 */
describe('ListingsFiltersComponent — price chip labels (dram formatting + i18n)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const chipTranslations = {
    listings: {
      filters: {
        chips: {
          minPrice: 'From {{amount}}',
          maxPrice: 'Up to {{amount}}',
        },
      },
    },
  };

  it('renders the minPrice chip with a grouped, NBSP-joined dram amount', async () => {
    const { component } = await navigateToListings('/listings?minPrice=7500', {
      translations: chipTranslations,
    });

    const chip = component.activeChips().find((c) => c.key === 'minPrice');
    expect(chip?.label).toBe(`From 7,500\u00A0֏`);
  });

  it('renders the maxPrice chip with a grouped, NBSP-joined dram amount', async () => {
    const { component } = await navigateToListings('/listings?maxPrice=120000', {
      translations: chipTranslations,
    });

    const chip = component.activeChips().find((c) => c.key === 'maxPrice');
    expect(chip?.label).toBe(`Up to 120,000\u00A0֏`);
  });

  it('renders both chips together, each formatted independently', async () => {
    const { component } = await navigateToListings('/listings?minPrice=1000&maxPrice=25000', {
      translations: chipTranslations,
    });

    const chips = component.activeChips();
    expect(chips.find((c) => c.key === 'minPrice')?.label).toBe(`From 1,000\u00A0֏`);
    expect(chips.find((c) => c.key === 'maxPrice')?.label).toBe(`Up to 25,000\u00A0֏`);
  });
});

describe('ListingsFiltersComponent — openSheetAt (AI no-results / location note)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no layout: scrollIntoView does not exist.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => vi.useRealTimers());

  it('"price" opens the sheet scrolled to price with "To" focused', async () => {
    const { component } = await navigateToListings('/listings');

    component.openSheetAt('price');
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();

    const field = document.getElementById('lf-field-price')!;
    expect(field).not.toBeNull();
    expect(field.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(document.getElementById('lf-max-price'));
  });

  it('"districts" opens the sheet scrolled to District with its control focused', async () => {
    const { component } = await navigateToListings('/listings');

    component.openSheetAt('districts');
    await vi.advanceTimersByTimeAsync(0);
    TestBed.tick();

    const field = document.getElementById('lf-field-districts')!;
    expect(field.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('lf-districts-input');
  });
});

describe('ListingsFiltersComponent — simple search debounce vs AI switch (design-notes 20)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mobile: a debounced q update that lands after AI was switched on never reaches the URL', async () => {
    const { component, router, store } = await navigateToListings('/listings?ai=1');
    store.overrideSelector(selectListingsAi, { ...initialListingsAiState, mode: true });
    store.refreshState();

    component.filterForm.controls.query.setValue('lego');
    await vi.advanceTimersByTimeAsync(400);

    expect(router.url).not.toContain('q=');
  });

  it('sheet Apply while AI is on still navigates and emits filtersChanged (feeds the re-rank)', async () => {
    const { component, router, store } = await navigateToListings('/listings?ai=1');
    store.overrideSelector(selectListingsAi, { ...initialListingsAiState, mode: true });
    store.refreshState();
    const emitted: { query: string | null; maxPrice: number | null }[] = [];
    component.filtersChanged.subscribe((f) => emitted.push(f));

    component.openSheet();
    component.draftForm.patchValue({ maxPrice: 5000 });
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).toContain('maxPrice=5000');
    expect(router.url).toContain('ai=1');
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ query: null, maxPrice: 5000 });
  });

  it('sheet Apply lands in the URL at once, so an AI switch-on right after keeps the filter', async () => {
    const { component, router } = await navigateToListings('/listings');

    component.openSheet();
    component.draftForm.patchValue({ maxPrice: 5000 });
    component.applySheet();
    await vi.advanceTimersByTimeAsync(50); // well inside the 300 ms typing debounce

    expect(router.url).toContain('maxPrice=5000');
  });

  it('a late text change after AI went on is ignored while other filters in the same flush still flow', async () => {
    const { component, router, store } = await navigateToListings('/listings?ai=1');
    store.overrideSelector(selectListingsAi, { ...initialListingsAiState, mode: true });
    store.refreshState();

    component.filterForm.controls.query.setValue('lego');
    component.filterForm.controls.maxPrice.setValue(4000);
    await vi.advanceTimersByTimeAsync(400);

    expect(router.url).toContain('maxPrice=4000');
    expect(router.url).not.toContain('q=');
  });

  it('removing a chip lands in the URL at once (flush), not after the typing debounce', async () => {
    const { component, router } = await navigateToListings('/listings?maxPrice=5000');

    (component as unknown as { removeChip(c: { key: string }): void }).removeChip({ key: 'maxPrice' });
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).not.toContain('maxPrice');
  });
});

describe('ListingsFiltersComponent — category labels follow the UI language (ADR-062)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const CATEGORIES: ListingCategoryOption[] = [
    {
      id: 'c1',
      name: 'Role play',
      nameHy: 'Դերախաղեր',
      nameRu: 'Сюжетно-ролевые игры',
      slug: 'role-play',
    },
  ];

  it('switches the category chip label and selector options live, without refetching', async () => {
    const { component, store } = await navigateToListings('/listings?categoryIds=c1', {
      categories: CATEGORIES,
    });
    const language = TestBed.inject(LanguageService);
    const chipLabel = () => component.activeChips().find((c) => c.key === 'categoryId')?.label;
    const optionLabels = () =>
      (component as unknown as { categoryOptions(): { id: string; label: string }[] }).categoryOptions();

    expect(chipLabel()).toBe('Role play');
    expect(optionLabels()[0]).toEqual({ id: 'c1', label: 'Role play' });
    vi.mocked(store.dispatch).mockClear();

    language.current.set(language.languages.find((l) => l.code === 'hy')!);
    expect(chipLabel()).toBe('Դերախաղեր');
    expect(optionLabels()[0].label).toBe('Դերախաղեր');

    language.current.set(language.languages.find((l) => l.code === 'ru')!);
    expect(chipLabel()).toBe('Сюжетно-ролевые игры');
    expect(optionLabels()[0].label).toBe('Сюжетно-ролевые игры');
    expect(store.dispatch).not.toHaveBeenCalled();
  });
});

/**
 * ADR-066: the sheet gets the same new controls as the desktop panel (multi category, multi age,
 * conditions). Legacy single-value links keep working, a PrimeNG clear writes `null` (M-040), and
 * the sheet never owns `sort` (the toolbar does), so a no-op Apply must not touch it (M-021).
 */
describe('ListingsFiltersComponent — ADR-066 multi-select controls', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('parses a legacy ?categoryId=&ageGroup= link into the new lists and rewrites it on Apply', async () => {
    const { component, router } = await navigateToListings('/listings?categoryId=c1&ageGroup=12-36');

    expect(component.activeChips().map((c) => `${c.key}:${c.value}`)).toEqual([
      'categoryId:c1',
      'ageGroup:12-36',
    ]);

    component.openSheet();
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('categoryIds=c1');
    expect(url).toContain('ageGroups=12-36');
    expect(url).not.toContain('categoryId=');
    expect(url).not.toContain('ageGroup=');
  });

  it('writes several categories, ages and conditions comma-joined and leaves sort alone', async () => {
    const { component, router } = await navigateToListings('/listings?sort=price_asc');

    component.openSheet();
    component.draftForm.patchValue({ categoryIds: ['c1', 'c2'] });
    component.toggleDraftAge('0-12');
    component.toggleDraftAge('120+');
    component.toggleDraftCondition('New');
    component.toggleDraftCondition('Fair');
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('categoryIds=c1,c2');
    expect(url).toContain('ageGroups=0-12,120%2B'); // `+` is percent-encoded by the router
    expect(url).toContain('conditions=New,Fair');
    expect(url).toContain('sort=price_asc');
  });

  it('tapping an active condition pill clears it again', async () => {
    const { component, router } = await navigateToListings('/listings?conditions=Good');

    component.openSheet();
    component.toggleDraftCondition('Good');
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).not.toContain('conditions=');
  });

  it('applySheet() with a null categoryIds draft (PrimeNG clear before onClear fires) does not throw and drops the key (M-040)', async () => {
    const { component, router } = await navigateToListings('/listings?categoryIds=c1,c2&view=map');

    component.openSheet();
    component.draftForm.controls.categoryIds.setValue(null);

    expect(() => component.applySheet()).not.toThrow();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).not.toContain('categoryIds=');
    expect(router.url).toContain('view=map');
  });

  it('onDraftCategoriesCleared() normalises the control back to []', async () => {
    const { component } = await navigateToListings('/listings?categoryIds=c1');

    component.openSheet();
    component.draftForm.controls.categoryIds.setValue(null);
    component.onDraftCategoriesCleared();

    expect(component.draftForm.getRawValue().categoryIds).toEqual([]);
  });

  it('removing one category chip keeps the others; a condition chip removes just that value', async () => {
    const { component, router } = await navigateToListings(
      '/listings?categoryIds=c1,c2&conditions=New,Good',
      { categories: [] },
    );

    const chip = (key: string, value: string) =>
      component.activeChips().find((c) => c.key === key && c.value === value)!;

    component.removeChip(chip('categoryId', 'c1'));
    component.removeChip(chip('condition', 'New'));
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).toContain('categoryIds=c2');
    expect(router.url).toContain('conditions=Good');
  });

  it('shows one chip per selected condition with its ADR-042 label key (never "Excellent")', async () => {
    const { component } = await navigateToListings('/listings?conditions=LikeNew,Excellent');

    expect(component.activeChips().map((c) => c.value)).toEqual(['LikeNew']);
  });
});
