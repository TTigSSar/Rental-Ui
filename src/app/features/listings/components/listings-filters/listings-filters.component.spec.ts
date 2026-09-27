import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService, type TranslationObject } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ListingsApiService } from '../../services/listings-api.service';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectListingCategories,
  selectListingsOriginCoords,
  selectListingsOriginDenied,
  selectListingsOriginSource,
} from '../../store/listings.selectors';
import { ListingsFiltersComponent } from './listings-filters.component';

/** Access to the sheet's protected surface without loosening it for production code. */
interface SheetAccess {
  applySheet(): void;
  clearSheet(): void;
  closeSheet(): void;
  openSheet(): void;
  onDraftRadiusMetersChange(meters: number): void;
  onDraftOriginCleared(): void;
  onDraftDistrictsCleared(): void;
  removeChip(chip: { key: string; label: string; districtId?: string }): void;
  readonly activeChips: () => ReadonlyArray<{
    key: string;
    label: string;
    districtId?: string;
  }>;
  readonly draftForm: {
    getRawValue(): {
      city: string;
      categoryId: string;
      minPrice: number | null;
      maxPrice: number | null;
      radiusKm: number | null;
      districtIds: string[];
    };
    patchValue(value: Record<string, unknown>): void;
    readonly controls: {
      readonly districtIds: { setValue(value: unknown): void };
    };
  };
}

/**
 * Regression coverage for M-021: the mobile filter sheet used to navigate
 * with `queryParamsHandling: 'replace'` and a `toQueryParams()` that only
 * ever emitted its own six keys — so applying/clearing the sheet silently
 * stripped ANY param it had no concept of, known or not (confirmed live:
 * `/listings?ageGroup=0-12&maxDistance=5` at 375px, tap "Apply" with zero
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
  options?: { translations?: TranslationObject },
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
          { selector: selectListingCategories, value: [] },
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

  it('tapping Apply with no changes preserves ageGroup (not sheet-owned) AND radiusKm (sheet-owned, round-tripped unchanged)', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroup=0-12&radiusKm=5',
    );

    component.openSheet();
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350); // flush the form's debounceTime(300)

    expect(router.url).toBe('/listings?ageGroup=0-12&radiusKm=5');
  });

  it('tapping Clear resets the sheet-owned radiusKm to null but still preserves ageGroup (not sheet-owned)', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroup=0-12&radiusKm=5',
    );

    component.openSheet();
    component.clearSheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('ageGroup=0-12');
    expect(url).not.toContain('radiusKm=');
  });

  it('applying a sheet-owned filter (city) still merges in alongside ageGroup and an existing radiusKm', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroup=0-12&radiusKm=5',
    );

    component.openSheet();
    component.draftForm.patchValue({ city: 'Yerevan' });
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('ageGroup=0-12');
    expect(url).toContain('radiusKm=5');
    expect(url).toContain('city=Yerevan');
  });

  it('clearing a sheet-owned filter actually removes its own param from the URL (merge still deletes what it owns)', async () => {
    const { component, router } = await navigateToListings(
      '/listings?ageGroup=0-12&radiusKm=5&city=Yerevan&categoryId=abc',
    );

    component.openSheet();
    component.clearSheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    // Sheet-owned filters actually cleared out of the URL...
    expect(url).not.toContain('city=');
    expect(url).not.toContain('categoryId=');
    expect(url).not.toContain('radiusKm=');
    // ...while a filter the sheet doesn't know about survives untouched.
    expect(url).toContain('ageGroup=0-12');
  });

  it('adjusting the radius in the sheet and applying commits the new value to the URL, merged with ageGroup', async () => {
    const { component, router } = await navigateToListings('/listings?ageGroup=0-12');

    component.openSheet();
    component.onDraftRadiusMetersChange(3000); // 3 km
    component.applySheet();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).toContain('ageGroup=0-12');
    expect(url).toContain('radiusKm=3');
  });

  it('closing the sheet without applying (Cancel) never touches the URL at all', async () => {
    const { component, router } = await navigateToListings('/listings?ageGroup=0-12&radiusKm=5');

    component.openSheet();
    component.onDraftRadiusMetersChange(10000); // 10 km, drafted but not applied
    component.closeSheet();
    await vi.advanceTimersByTimeAsync(350);

    expect(router.url).toBe('/listings?ageGroup=0-12&radiusKm=5');
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
    const { component, router } = await navigateToListings('/listings?ageGroup=0-12&radiusKm=5');

    component.openSheet();
    component.onDraftOriginCleared();
    await vi.advanceTimersByTimeAsync(350);

    expect(component.draftForm.getRawValue().radiusKm).toBeNull();
    const url = router.url;
    expect(url).not.toContain('radiusKm=');
    // ageGroup (not sheet-owned) still survives the merge-navigate.
    expect(url).toContain('ageGroup=0-12');
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
      '/listings?ageGroup=0-12&districtIds=d1,d2',
    );

    component.openSheet();
    component.draftForm.controls.districtIds.setValue(null);

    expect(() => component.applySheet()).not.toThrow();
    await vi.advanceTimersByTimeAsync(350);

    const url = router.url;
    expect(url).not.toContain('districtIds=');
    expect(url).toContain('ageGroup=0-12');
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
