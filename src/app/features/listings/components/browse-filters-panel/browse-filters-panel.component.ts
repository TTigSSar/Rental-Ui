import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LanguageService } from '../../../../shared/services/language.service';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { DEFAULT_CATEGORY_ICON, toSafeCategoryColor } from '../../../../shared/utils/category-palette.model';
import { categoryDisplayName } from '../../../../shared/utils/category-name.utils';
import { DRAM_SYMBOL } from '../../../../shared/utils/dram-currency.pipe';
import { AGE_GROUPS } from '../../models/age-groups.const';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import { districtDisplayName } from '../../models/district-ui.util';
import type { ListingDistrict } from '../../models/district.model';
import type { ListingFacets } from '../../models/listing-facets.model';
import {
  LISTING_CONDITION_FILTERS,
  type ListingConditionFilter,
  type ListingsFilter,
} from '../../models/listings-filter.model';
import { RadiusOriginFilterComponent } from '../radius-origin-filter/radius-origin-filter.component';

/** The filter fields this panel edits; the page turns a patch into one merge-navigation (M-021). */
export type BrowseFilterPatch = Partial<
  Pick<ListingsFilter, 'categoryIds' | 'ageGroups' | 'conditions' | 'minPrice' | 'maxPrice' | 'districtIds'>
>;

export type BrowseSectionKey = 'cat' | 'age' | 'price' | 'dist' | 'cond' | 'distance';

/** Design: first 6 categories / first 5 districts, then "Show all N". */
export const BROWSE_CATEGORIES_COLLAPSED = 6;
export const BROWSE_DISTRICTS_COLLAPSED = 5;
/** Price slider granularity (AMD) and the fallback upper bound while the facets have no price yet. */
export const BROWSE_PRICE_STEP = 50;
export const BROWSE_PRICE_FALLBACK_MAX = 10000;

const CONDITION_LABEL_KEYS: Record<ListingConditionFilter, string> = {
  New: 'listings.details.conditionValues.new',
  LikeNew: 'listings.details.conditionValues.likeNew',
  Good: 'listings.details.conditionValues.good',
  Fair: 'listings.details.conditionValues.fair',
};

interface CategoryRow {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
  readonly icon: string;
  readonly color: string;
}

interface DistrictRow {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
}

/**
 * Desktop browse sidebar (ADR-066, browse-redesign design notes 1-4): collapsible sections with
 * selection badges, facet counts, and a "Clear all". Presentational: it never navigates; every
 * edit is a `patch` the page merges into the URL.
 */
@Component({
  selector: 'app-browse-filters-panel',
  standalone: true,
  imports: [IconComponent, RadiusOriginFilterComponent, TranslatePipe],
  templateUrl: './browse-filters-panel.component.html',
  styleUrl: './browse-filters-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseFiltersPanelComponent {
  private readonly languageService = inject(LanguageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly filters = input.required<ListingsFilter>();
  readonly categories = input<readonly ListingCategoryOption[]>([]);
  readonly districts = input<readonly ListingDistrict[]>([]);
  /** `null` until the first facets response (or after a failure): rows then show no counts. */
  readonly facets = input<ListingFacets | null>(null);
  /** The radius filter's value in metres (`RadiusOriginFilterComponent` works in metres). */
  readonly radiusMeters = input<number | null>(null);
  /** A radius is set AND an origin exists: counts as one selection in the header badge. */
  readonly distanceActive = input(false);

  readonly patch = output<BrowseFilterPatch>();
  readonly clearAll = output<void>();
  readonly radiusMetersChange = output<number>();
  readonly originCleared = output<void>();

  protected readonly dramSymbol = DRAM_SYMBOL;
  protected readonly priceStep = BROWSE_PRICE_STEP;
  protected readonly ageGroups = AGE_GROUPS;
  protected readonly conditionOptions = LISTING_CONDITION_FILTERS.map((value) => ({
    value,
    labelKey: CONDITION_LABEL_KEYS[value],
  }));

  private readonly maxPriceInput = viewChild<ElementRef<HTMLInputElement>>('maxPriceInput');
  private readonly districtSearchInput = viewChild<ElementRef<HTMLInputElement>>('districtSearchInput');

  protected readonly open = signal<Record<BrowseSectionKey, boolean>>({
    cat: true,
    age: true,
    price: true,
    dist: true,
    cond: false,
    distance: true,
  });
  protected readonly showAllCategories = signal(false);
  protected readonly showAllDistricts = signal(false);
  protected readonly districtQuery = signal('');

  /** Slider values while a thumb is being dragged (committed on release / change). */
  private readonly dragLo = signal<number | null>(null);
  private readonly dragHi = signal<number | null>(null);

  // ── Badges ───────────────────────────────────────────────────────────
  protected readonly priceSelected = computed(
    () => this.filters().minPrice != null || this.filters().maxPrice != null,
  );
  protected readonly totalSelected = computed(() => {
    const f = this.filters();
    return (
      f.categoryIds.length +
      f.ageGroups.length +
      f.conditions.length +
      f.districtIds.length +
      (this.priceSelected() ? 1 : 0) +
      (this.distanceActive() ? 1 : 0)
    );
  });

  // ── Category ─────────────────────────────────────────────────────────
  private readonly categoryCounts = computed(
    () => new Map((this.facets()?.categories ?? []).map((c) => [c.categoryId, c.count])),
  );
  private readonly categoryRows = computed((): CategoryRow[] => {
    const lang = this.languageService.current().code;
    const selected = new Set(this.filters().categoryIds);
    const counts = this.categoryCounts();
    return this.categories().map((c) => ({
      id: c.id,
      label: categoryDisplayName(c, lang),
      count: counts.get(c.id) ?? 0,
      selected: selected.has(c.id),
      icon: c.iconName || DEFAULT_CATEGORY_ICON,
      color: toSafeCategoryColor(c.colorHex),
    }));
  });
  protected readonly categoryTotal = computed(() => this.categoryRows().length);
  /** A selected category beyond the first 6 stays visible while the list is collapsed. */
  protected readonly visibleCategories = computed(() => {
    const rows = this.categoryRows();
    return this.showAllCategories()
      ? rows
      : rows.filter((r, i) => i < BROWSE_CATEGORIES_COLLAPSED || r.selected);
  });
  protected readonly categoriesCollapsible = computed(
    () => this.categoryTotal() > BROWSE_CATEGORIES_COLLAPSED,
  );

  // ── District ─────────────────────────────────────────────────────────
  private readonly districtCounts = computed(
    () => new Map((this.facets()?.districts ?? []).map((d) => [d.districtId, d.count])),
  );
  private readonly districtRows = computed((): DistrictRow[] => {
    const lang = this.languageService.current().code;
    const selected = new Set(this.filters().districtIds);
    const counts = this.districtCounts();
    return this.districts().map((d) => ({
      id: d.id,
      label: districtDisplayName(d, lang),
      count: counts.get(d.id) ?? 0,
      selected: selected.has(d.id),
    }));
  });
  protected readonly districtTotal = computed(() => this.districtRows().length);
  protected readonly searching = computed(() => this.districtQuery().trim().length > 0);
  protected readonly visibleDistricts = computed(() => {
    const q = this.districtQuery().trim().toLowerCase();
    const rows = this.districtRows();
    if (q) return rows.filter((r) => r.label.toLowerCase().includes(q));
    return this.showAllDistricts()
      ? rows
      : rows.filter((r, i) => i < BROWSE_DISTRICTS_COLLAPSED || r.selected);
  });
  protected readonly districtsCollapsible = computed(
    () => this.districtTotal() > BROWSE_DISTRICTS_COLLAPSED,
  );

  // ── Price ────────────────────────────────────────────────────────────
  /** Slider bounds: the facets' min/max (computed without the price filter), widened to include a
   *  selection that lies outside them, snapped to the slider step. */
  protected readonly priceBounds = computed(() => {
    const f = this.facets();
    const { minPrice, maxPrice } = this.filters();
    const step = BROWSE_PRICE_STEP;
    let lo = f?.minPricePerDay ?? 0;
    let hi = f?.maxPricePerDay ?? BROWSE_PRICE_FALLBACK_MAX;
    if (minPrice != null) lo = Math.min(lo, minPrice);
    if (maxPrice != null) hi = Math.max(hi, maxPrice);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    if (hi <= lo) hi = lo + step;
    return { lo, hi };
  });
  protected readonly priceLo = computed(() => {
    const { lo, hi } = this.priceBounds();
    const value = this.dragLo() ?? this.filters().minPrice ?? lo;
    return Math.min(Math.max(value, lo), hi);
  });
  protected readonly priceHi = computed(() => {
    const { lo, hi } = this.priceBounds();
    const value = this.dragHi() ?? this.filters().maxPrice ?? hi;
    return Math.min(Math.max(value, lo), hi);
  });
  private fraction(value: number): number {
    const { lo, hi } = this.priceBounds();
    return (value - lo) / (hi - lo);
  }
  /** Fill edges as 0..1 fractions of the usable track (thumb-width inset is added in the template). */
  protected readonly fillStart = computed(() => this.fraction(this.priceLo()));
  protected readonly fillEnd = computed(() => 1 - this.fraction(this.priceHi()));
  /** The lower thumb takes the top layer once both sit at the upper half, so it can be pulled back. */
  protected readonly loOnTop = computed(() => {
    const { lo, hi } = this.priceBounds();
    return this.priceLo() > (lo + hi) / 2;
  });

  // ── Handlers ─────────────────────────────────────────────────────────
  protected toggleSection(key: BrowseSectionKey): void {
    this.open.update((o) => ({ ...o, [key]: !o[key] }));
  }

  private static toggled<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  protected toggleCategory(id: string): void {
    this.patch.emit({ categoryIds: BrowseFiltersPanelComponent.toggled(this.filters().categoryIds, id) });
  }

  protected toggleAge(token: string): void {
    this.patch.emit({ ageGroups: BrowseFiltersPanelComponent.toggled(this.filters().ageGroups, token) });
  }

  protected toggleCondition(value: ListingConditionFilter): void {
    this.patch.emit({ conditions: BrowseFiltersPanelComponent.toggled(this.filters().conditions, value) });
  }

  protected toggleDistrict(id: string): void {
    this.patch.emit({ districtIds: BrowseFiltersPanelComponent.toggled(this.filters().districtIds, id) });
  }

  protected onDistrictQuery(event: Event): void {
    this.districtQuery.set((event.target as HTMLInputElement).value);
  }

  /** Slider drag (`input`): only the local value moves; the URL is written on release. */
  protected onSliderInput(which: 'lo' | 'hi', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(value)) return;
    if (which === 'lo') this.dragLo.set(Math.min(value, this.priceHi()));
    else this.dragHi.set(Math.max(value, this.priceLo()));
  }

  /** Slider release or box edit (`change`): commits the value; the bound itself means "no limit". */
  protected commitPrice(which: 'lo' | 'hi', event: Event): void {
    const el = event.target as HTMLInputElement;
    const raw = el.value.trim();
    const { lo, hi } = this.priceBounds();
    this.dragLo.set(null);
    this.dragHi.set(null);
    if (raw === '' || !Number.isFinite(Number(raw))) {
      this.patch.emit(which === 'lo' ? { minPrice: null } : { maxPrice: null });
      return;
    }
    let value = Math.round(Number(raw));
    if (which === 'lo') {
      value = Math.min(Math.max(value, lo), this.priceHi());
      this.patch.emit({ minPrice: value <= lo ? null : value });
    } else {
      value = Math.max(Math.min(value, hi), this.priceLo());
      this.patch.emit({ maxPrice: value >= hi ? null : value });
    }
    // A box left showing an out-of-range number would otherwise stay until the URL round-trips.
    el.value = String(value);
  }

  // ── Page hooks (no-results actions) ──────────────────────────────────
  /** `false` while the panel sits in a `display: none` container (below the desktop breakpoint). */
  isVisible(): boolean {
    return this.host.nativeElement.offsetParent !== null;
  }

  focusMaxPrice(): void {
    this.open.update((o) => ({ ...o, price: true }));
    queueMicrotask(() => {
      const input = this.maxPriceInput()?.nativeElement;
      input?.scrollIntoView({ block: 'center' });
      input?.focus({ preventScroll: true });
    });
  }

  focusDistrictSearch(): void {
    this.open.update((o) => ({ ...o, dist: true }));
    queueMicrotask(() => {
      const input = this.districtSearchInput()?.nativeElement;
      input?.scrollIntoView({ block: 'center' });
      input?.focus({ preventScroll: true });
    });
  }
}
