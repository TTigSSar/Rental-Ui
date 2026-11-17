import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  inject,
  Injector,
  afterNextRender,
  viewChild,
  input,
  OnDestroy,
  OnInit,
  Output,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { Subject, catchError, debounce, merge, of, startWith, timer } from 'rxjs';

import { LanguageService } from '../../../../shared/services/language.service';
import { categoryDisplayName } from '../../../../shared/utils/category-name.utils';
import { DramCurrencyPipe } from '../../../../shared/utils/dram-currency.pipe';
import { AGE_GROUPS } from '../../models/age-groups.const';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingDistrict } from '../../models/district.model';
import {
  LISTING_CONDITION_FILTERS,
  parseConditionsParam,
  parseListingsFilterFromParams,
  serializeDistrictIdsParam,
  serializeListParam,
  serializeRadiusKmParam,
  type ListingConditionFilter,
  type ListingsFilter,
} from '../../models/listings-filter.model';
import {
  formatDistanceMeters,
  kmToMeters,
  localeTagForLanguage,
  metersToKm,
} from '../../models/radius-scale.util';
import { radiusChipLabel } from '../../models/radius-chip.util';
import { AiSearchFieldComponent } from '../ai-search-field/ai-search-field.component';
import { RadiusOriginFilterComponent } from '../radius-origin-filter/radius-origin-filter.component';
import { ListingsApiService } from '../../services/listings-api.service';
import * as ListingsActions from '../../store/listings.actions';
import {
  selectAiMode,
  selectListingCategories,
  selectListingsOriginCoords,
  selectListingsOriginSource,
} from '../../store/listings.selectors';

/** Options fed to `p-multiSelect`: id is the value, `label` is the district's
 *  display name already resolved for the active UI language (see
 *  `districtOptions` below) — `p-multiSelect` itself can't call
 *  `districtDisplayName()` per-option, so the resolution happens once here. */
interface DistrictOption {
  readonly id: string;
  readonly label: string;
}

interface ActiveChip {
  readonly key:
    | 'city'
    | 'categoryId'
    | 'ageGroup'
    | 'condition'
    | 'minPrice'
    | 'maxPrice'
    | 'districtId'
    | 'radiusKm';
  readonly label: string;
  /** Identifies which value a multi-value chip removes (category id / age token / condition / district id). */
  readonly value?: string;
  /** Only set for `key: 'districtId'` — kept for the chip's track key; same as `value`. */
  readonly districtId?: string;
}

const CONDITION_LABEL_KEYS: Record<ListingConditionFilter, string> = {
  New: 'listings.details.conditionValues.new',
  LikeNew: 'listings.details.conditionValues.likeNew',
  Good: 'listings.details.conditionValues.good',
  Fair: 'listings.details.conditionValues.fair',
};

@Component({
  selector: 'app-listings-filters',
  standalone: true,
  imports: [
    AiSearchFieldComponent,
    InputNumberModule,
    MultiSelectModule,
    RadiusOriginFilterComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  // `DramCurrencyPipe` is also `inject()`-ed directly below (for the price
  // chip labels, formatted outside the template — see `activeChips`).
  // Listing it in `imports` only makes `| dram` resolvable in the template;
  // it does NOT register it as an injectable, so it must be listed here too
  // or the component throws NG0201 on construction (see
  // `listing-details-page.component.ts`'s identical `providers` note and
  // `knowledge/mistakes.md` M-028 for the exact failure mode).
  providers: [DramCurrencyPipe],
  templateUrl: './listings-filters.component.html',
  styleUrl: './listings-filters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListingsFiltersComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store);
  private readonly flush$ = new Subject<void>();
  private readonly aiMode = this.store.selectSignal(selectAiMode);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly listingsApi = inject(ListingsApiService);
  private readonly languageService = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly dramPipe = inject(DramCurrencyPipe);

  @Output() readonly filtersChanged = new EventEmitter<ListingsFilter>();
  /** A guest submitted an AI description — the page opens the sign-in dialog. */
  readonly authRequired = output<void>();

  protected readonly ageGroups = AGE_GROUPS;
  protected readonly conditionOptions = LISTING_CONDITION_FILTERS.map((value) => ({
    value,
    labelKey: CONDITION_LABEL_KEYS[value],
  }));

  /** When false, the active-filter chip row is suppressed (parent renders chips instead). */
  readonly showChips = input(true);

  protected readonly categories = toSignal(
    this.store.select(selectListingCategories),
    { initialValue: [] as ListingCategoryOption[] },
  );

  /** Options for the multi-select: id is the value, `label` the name in the UI language. */
  protected readonly categoryOptions = computed((): DistrictOption[] =>
    this.categories().map((c) => ({
      id: c.id,
      label: categoryDisplayName(c, this.languageService.current().code),
    })),
  );

  // Anonymous, unchanging reference data — same treatment as
  // `CreateListingPageComponent`'s own `districts` stream: no NgRx slice, a
  // failed fetch just yields an empty list rather than a blocking error.
  protected readonly districts = toSignal(
    this.listingsApi.getDistricts().pipe(
      startWith<ListingDistrict[]>([]),
      catchError(() => of<ListingDistrict[]>([])),
    ),
    { initialValue: [] as ListingDistrict[] },
  );

  protected readonly districtOptions = computed((): DistrictOption[] => {
    const lang = this.languageService.current().code;
    return this.districts().map((d) => ({ id: d.id, label: districtDisplayName(d, lang) }));
  });

  /** Read ONLY to gate the radius chip's honesty — see `activeChips` below
   *  and `ListingsPageComponent`'s identical `originCoordsSignal`. */
  protected readonly originCoords = this.store.selectSignal(selectListingsOriginCoords);
  /** Which origin the radius is measured from — decides the chip's wording
   *  ("Within 3 km of home" vs "3 km · from you"); see `radiusChipLabel`. */
  protected readonly originSource = this.store.selectSignal(selectListingsOriginSource);

  readonly filterForm = this.fb.group({
    query: this.fb.nonNullable.control(''),
    city: this.fb.nonNullable.control(''),
    categoryIds: this.fb.nonNullable.control<string[]>([]),
    ageGroups: this.fb.nonNullable.control<string[]>([]),
    conditions: this.fb.nonNullable.control<string[]>([]),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
    radiusKm: this.fb.control<number | null>(null),
    districtIds: this.fb.nonNullable.control<string[]>([]),
  });

  readonly draftForm = this.fb.group({
    city: this.fb.nonNullable.control(''),
    categoryIds: this.fb.nonNullable.control<string[]>([]),
    ageGroups: this.fb.nonNullable.control<string[]>([]),
    conditions: this.fb.nonNullable.control<string[]>([]),
    minPrice: this.fb.control<number | null>(null),
    maxPrice: this.fb.control<number | null>(null),
    radiusKm: this.fb.control<number | null>(null),
    districtIds: this.fb.nonNullable.control<string[]>([]),
  });

  private readonly formValues = signal(this.filterForm.getRawValue());

  // Live mirror of `draftForm.controls.radiusKm` — a plain FormControl has no
  // signal of its own, and `[radiusMeters]` (below) needs one to re-render
  // the slider as the control changes (`openSheet()` snapshotting it in,
  // the shared component's own output setting it, etc).
  private readonly draftRadiusKmSignal = toSignal(this.draftForm.controls.radiusKm.valueChanges, {
    initialValue: this.draftForm.controls.radiusKm.value,
  });

  /**
   * `RadiusOriginFilterComponent` works in METRES (its slider math is
   * metre-based) — `draftForm.controls.radiusKm` stores fractional km like
   * every other filter field, so this class converts at its own boundary,
   * same as `ListingsPageComponent.activeRadiusMeters`/`onRadiusMetersChange`.
   * The shared component's own `[radiusMeters]`/`(radiusMetersChange)` API is
   * plain input/output (not a `ControlValueAccessor`) because the desktop
   * sidebar has no reactive form to bind a `formControlName` to at all.
   */
  protected readonly draftRadiusMeters = computed(() => {
    const km = this.draftRadiusKmSignal();
    return km != null ? kmToMeters(km) : null;
  });

  protected onDraftRadiusMetersChange(meters: number): void {
    this.draftForm.controls.radiusKm.setValue(metersToKm(meters));
  }

  /**
   * `RadiusOriginFilterComponent`'s `(originCleared)` — the widget already
   * dispatched `ListingsActions.clearOrigin()` itself. Unlike every other
   * draft field here, this commits `radiusKm` to `filterForm` (and therefore
   * the URL) IMMEDIATELY instead of waiting for "Apply": the origin removal
   * it rides along with is itself immediate and can't be cancelled, so
   * staging just the radius would leave an inert `radiusKm` in the URL with
   * no origin behind it if the sheet were then dismissed with "Cancel"
   * (Trello #80).
   */
  protected onDraftOriginCleared(): void {
    this.draftForm.controls.radiusKm.setValue(null);
    this.filterForm.patchValue({ radiusKm: null });
    this.flush$.next();
  }

  /**
   * `p-multiSelect`'s `(onClear)` — PrimeNG 21.1.6's `MultiSelect.clear()`
   * calls `updateModel(null, event)` BEFORE it emits `onClear`, so the "×"
   * on the districts field writes a raw `null` into `draftForm.controls.
   * districtIds` (typed `string[]`, nonNullable) for one tick. Left alone,
   * that `null` survives into `applySheet()`/`activeChips`/
   * `serializeDistrictIdsParam` and throws. This normalizes it back to `[]`
   * the moment PrimeNG's clear fires, before anything else reads the
   * control.
   */
  protected toggleDraftAge(value: string): void {
    this.toggleDraft(this.draftForm.controls.ageGroups, value);
  }

  protected toggleDraftCondition(value: string): void {
    this.toggleDraft(this.draftForm.controls.conditions, value);
  }

  private toggleDraft(control: { value: string[]; setValue(v: string[]): void }, value: string): void {
    const current = control.value ?? [];
    control.setValue(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  protected onDraftDistrictsCleared(): void {
    this.draftForm.controls.districtIds.setValue([]);
  }

  /** Same PrimeNG `clear()` -> `null` hazard as districts (M-040): normalise back to `[]`. */
  protected onDraftCategoriesCleared(): void {
    this.draftForm.controls.categoryIds.setValue([]);
  }

  private readonly localeTag = computed(() =>
    localeTagForLanguage(this.languageService.current().code),
  );

  /**
   * `DramCurrencyPipe` invoked directly (not via the `| dram` template pipe)
   * because the price chip labels are built as plain strings for
   * `translate.instant()`'s `amount` param — see `activeChips` below.
   */
  private formatDram(amount: number): string {
    return this.dramPipe.transform(amount) ?? '';
  }

  protected readonly activeChips = computed((): readonly ActiveChip[] => {
    const v = this.formValues();
    const chips: ActiveChip[] = [];
    for (const id of v.categoryIds) {
      const cat = this.categories().find((c) => c.id === id);
      chips.push({
        key: 'categoryId',
        value: id,
        label: cat ? categoryDisplayName(cat, this.languageService.current().code) : id,
      });
    }
    for (const token of v.ageGroups) {
      const ag = AGE_GROUPS.find((a) => a.value === token);
      chips.push({
        key: 'ageGroup',
        value: token,
        label: ag ? this.translate.instant(ag.labelKey) : token,
      });
    }
    if (v.minPrice != null) {
      chips.push({
        key: 'minPrice',
        label: this.translate.instant('listings.filters.chips.minPrice', {
          amount: this.formatDram(v.minPrice),
        }),
      });
    }
    if (v.maxPrice != null) {
      chips.push({
        key: 'maxPrice',
        label: this.translate.instant('listings.filters.chips.maxPrice', {
          amount: this.formatDram(v.maxPrice),
        }),
      });
    }
    // Gated on `originCoords()`, not just `v.radiusKm` — see
    // `ListingsPageComponent.activeFilterChips`'s identical reasoning.
    if (v.radiusKm != null && this.originCoords() !== null) {
      const distanceLabel = formatDistanceMeters(kmToMeters(v.radiusKm), this.localeTag(), {
        meters: this.translate.instant('listings.filters.distance.unitMeters'),
        kilometers: this.translate.instant('listings.filters.distance.unitKilometers'),
      });
      chips.push({
        key: 'radiusKm',
        label: radiusChipLabel(distanceLabel, this.originSource(), this.translate),
      });
    }
    for (const districtId of v.districtIds) {
      const district = this.districtOptions().find((d) => d.id === districtId);
      chips.push({ key: 'districtId', value: districtId, label: district?.label ?? districtId, districtId });
    }
    for (const condition of v.conditions) {
      const key = CONDITION_LABEL_KEYS[condition as ListingConditionFilter];
      chips.push({ key: 'condition', value: condition, label: key ? this.translate.instant(key) : condition });
    }
    return chips;
  });

  protected readonly hasSheetFilters = computed(() => {
    const v = this.formValues();
    return !!(
      v.city.trim() ||
      v.categoryIds.length > 0 ||
      v.ageGroups.length > 0 ||
      v.conditions.length > 0 ||
      v.minPrice != null ||
      v.maxPrice != null ||
      v.radiusKm != null ||
      v.districtIds.length > 0
    );
  });

  protected readonly sheetOpen = signal(false);

  constructor() {
    this.filterForm.valueChanges
      // Typing is debounced; a sheet Apply / Clear / chip removal flushes at once (`flush$`), so
      // a fast AI switch-on right after cannot lose the change.
      .pipe(
        debounce(() => merge(timer(300), this.flush$)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.formValues.set(this.filterForm.getRawValue());
        const filter = this.toListingsFilter();
        // While AI is on the typed text is the AI description, never `q`: a late text change
        // (switch-on within the debounce window) is ignored; every other filter flows as usual.
        if (this.aiMode()) filter.query = null;
        void this.router.navigate([], {
          relativeTo: this.route,
          // 'merge' (not 'replace'): this form only ever knows about its own
          // OWNED fields (see `toQueryParams` below — M-021: a sibling filter
          // this form has no concept of would be silently dropped under
          // 'replace'). `ageGroup` is one of them since the AI-search card
          // (the sheet gained the age pills; the desktop sidebar writes the
          // same URL param) — `radiusKm`, likewise, IS one of this form's own
          // fields (below), exactly like `districtIds`: both surfaces read
          // and write the same URL param, so there is only ever one copy of
          // this state to drift. Each of this form's own keys is still
          // explicitly set to `null` when cleared, so 'merge' + explicit null
          // still removes them; it only leaves keys this form never mentions
          // untouched.
          queryParams: this.toQueryParams(filter),
          queryParamsHandling: 'merge',
        });
        this.filtersChanged.emit(filter);
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        // One shared URL parser (legacy `categoryId` / `ageGroup` links included).
        const parsed = parseListingsFilterFromParams(params);
        this.filterForm.patchValue(
          {
            query: params.get('q') ?? '',
            city: params.get('city') ?? '',
            categoryIds: parsed.categoryIds,
            ageGroups: parsed.ageGroups,
            conditions: parsed.conditions,
            minPrice: parsed.minPrice,
            maxPrice: parsed.maxPrice,
            radiusKm: parsed.radiusKm,
            districtIds: parsed.districtIds,
          },
          { emitEvent: false },
        );
        this.formValues.set(this.filterForm.getRawValue());
      });
  }

  ngOnInit(): void {
    this.store.dispatch(ListingsActions.loadListingCategories());
  }

  ngOnDestroy(): void {
    this.doc.body.classList.remove('body--sheet-open');
  }

  protected openSheet(): void {
    const v = this.filterForm.getRawValue();
    this.draftForm.setValue({
      city: v.city,
      categoryIds: v.categoryIds,
      ageGroups: v.ageGroups,
      conditions: v.conditions,
      minPrice: v.minPrice,
      maxPrice: v.maxPrice,
      radiusKm: v.radiusKm,
      districtIds: v.districtIds,
    });
    this.sheetOpen.set(true);
    this.doc.body.classList.add('body--sheet-open');
  }

  private readonly aiField = viewChild(AiSearchFieldComponent);

  /**
   * Opens the sheet scrolled to a section with its first control focused - the mobile half of the
   * no-results "Increase the budget" (price "To") and the "Choose a district" note link.
   */
  openSheetAt(section: 'price' | 'districts'): void {
    this.openSheet();
    afterNextRender(
      () => {
        const field = this.doc.getElementById(section === 'price' ? 'lf-field-price' : 'lf-field-districts');
        field?.scrollIntoView({ block: 'center' });
        const control = this.doc.getElementById(section === 'price' ? 'lf-max-price' : 'lf-districts-input');
        control?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  /** The mobile AI field, for "Edit description". */
  focusAiField(): void {
    this.aiField()?.focusEnd();
  }

  /** Whether the mobile search bar is the visible one (below the desktop breakpoint). */
  isBarVisible(): boolean {
    return this.aiField()?.isVisible() ?? false;
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
    this.doc.body.classList.remove('body--sheet-open');
  }

  protected applySheet(): void {
    const draft = this.draftForm.getRawValue();
    this.filterForm.patchValue({
      city: draft.city,
      // Defensive (M-040): a PrimeNG clear can leave a raw `null` in an array control.
      categoryIds: draft.categoryIds ?? [],
      ageGroups: draft.ageGroups ?? [],
      conditions: draft.conditions ?? [],
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
      radiusKm: draft.radiusKm,
      // Defensive: `(onClear)` above should already have normalized a
      // PrimeNG multiselect clear back to `[]`, but a raw `null` here would
      // otherwise reach `serializeDistrictIdsParam()` (which throws on
      // anything but an array) and `activeChips`'s iteration.
      districtIds: draft.districtIds ?? [],
    });
    this.flush$.next();
    this.closeSheet();
  }

  protected clearSheet(): void {
    this.store.dispatch(ListingsActions.clearOrigin());
    const currentQuery = this.filterForm.getRawValue().query;
    this.filterForm.setValue({
      query: currentQuery,
      city: '',
      categoryIds: [],
      ageGroups: [],
      conditions: [],
      minPrice: null,
      maxPrice: null,
      radiusKm: null,
      districtIds: [],
    });
    this.flush$.next();
    this.closeSheet();
  }

  protected removeChip(chip: ActiveChip): void {
    switch (chip.key) {
      case 'city':
        this.filterForm.patchValue({ city: '' });
        break;
      case 'categoryId':
        this.filterForm.patchValue({
          categoryIds: this.filterForm.getRawValue().categoryIds.filter((id) => id !== chip.value),
        });
        break;
      case 'ageGroup':
        this.filterForm.patchValue({
          ageGroups: this.filterForm.getRawValue().ageGroups.filter((t) => t !== chip.value),
        });
        break;
      case 'condition':
        this.filterForm.patchValue({
          conditions: this.filterForm.getRawValue().conditions.filter((c) => c !== chip.value),
        });
        break;
      case 'minPrice':
        this.filterForm.patchValue({ minPrice: null });
        break;
      case 'maxPrice':
        this.filterForm.patchValue({ maxPrice: null });
        break;
      case 'radiusKm':
        // The chip reads "1 km · from you" — its × removes the whole
        // location filter, not just the radius number (Trello #80).
        this.store.dispatch(ListingsActions.clearOrigin());
        this.filterForm.patchValue({ radiusKm: null });
        break;
      case 'districtId': {
        const current = this.filterForm.getRawValue().districtIds;
        this.filterForm.patchValue({
          districtIds: current.filter((id) => id !== chip.districtId),
        });
        break;
      }
    }
    this.flush$.next();
  }

  /**
   * The filter set the sheet owns. `sort` is not a sheet field (the toolbar owns it) and is never
   * written from here: with `queryParamsHandling: 'merge'` an absent key is left alone (M-021).
   */
  private toListingsFilter(): ListingsFilter {
    const raw = this.filterForm.getRawValue();
    return {
      query: raw.query.trim() || null,
      city: raw.city.trim() || null,
      categoryIds: raw.categoryIds ?? [],
      minPrice: raw.minPrice,
      maxPrice: raw.maxPrice,
      ageGroups: raw.ageGroups ?? [],
      conditions: parseConditionsParam(serializeListParam(raw.conditions ?? [])),
      sort: 'newest',
      radiusKm: raw.radiusKm,
      districtIds: raw.districtIds ?? [],
    };
  }

  private toQueryParams(filter: ListingsFilter): Record<string, string | null> {
    return {
      q: filter.query,
      city: filter.city,
      categoryIds: serializeListParam(filter.categoryIds),
      // The legacy single-value keys are always cleared next to the lists that replace them.
      categoryId: null,
      ageGroups: serializeListParam(filter.ageGroups),
      ageGroup: null,
      conditions: serializeListParam(filter.conditions),
      minPrice: filter.minPrice != null ? String(filter.minPrice) : null,
      maxPrice: filter.maxPrice != null ? String(filter.maxPrice) : null,
      radiusKm: serializeRadiusKmParam(filter.radiusKm),
      districtIds: serializeDistrictIdsParam(filter.districtIds),
    };
  }
}
