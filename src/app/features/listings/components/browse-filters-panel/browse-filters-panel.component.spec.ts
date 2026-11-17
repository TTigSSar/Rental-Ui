import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { GeolocationService } from '../../../../shared/services/geolocation.service';
import type { ListingCategoryOption } from '../../models/create-listing.model';
import type { ListingDistrict } from '../../models/district.model';
import type { ListingFacets } from '../../models/listing-facets.model';
import type { ListingsFilter } from '../../models/listings-filter.model';
import {
  selectListingsOriginCoords,
  selectListingsOriginDenied,
  selectListingsOriginSource,
} from '../../store/listings.selectors';
import {
  BrowseFiltersPanelComponent,
  type BrowseFilterPatch,
} from './browse-filters-panel.component';

// `app-radius-origin-filter` reaches `MapComponent` -> leaflet; this spec is about the panel only.
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    on: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 40.1776, lng: 44.5126 })),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  marker: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

const EMPTY: ListingsFilter = {
  query: null,
  city: null,
  categoryIds: [],
  minPrice: null,
  maxPrice: null,
  ageGroups: [],
  conditions: [],
  sort: 'newest',
  radiusKm: null,
  districtIds: [],
};

const CATEGORIES: ListingCategoryOption[] = Array.from({ length: 9 }, (_, i) => ({
  id: `c${i + 1}`,
  name: `Category ${i + 1}`,
  nameHy: '',
  nameRu: `Категория ${i + 1}`,
  slug: `cat-${i + 1}`,
  iconName: i === 0 ? 'heart' : null,
  colorHex: i === 0 ? '#FFE0E0' : null,
}));

const DISTRICT_NAMES = ['Ajapnyak', 'Arabkir', 'Avan', 'Davtashen', 'Erebuni', 'Kentron', 'Nor Nork'];
const DISTRICTS: ListingDistrict[] = DISTRICT_NAMES.map((name, i) => ({
  id: `d${i + 1}`,
  code: name.toLowerCase(),
  nameEn: name,
  nameHy: name,
  nameRu: name,
}));

const FACETS: ListingFacets = {
  categories: [
    { categoryId: 'c1', count: 7 },
    { categoryId: 'c2', count: 3 },
  ],
  districts: [{ districtId: 'd6', count: 12 }],
  minPricePerDay: 520,
  maxPricePerDay: 9980,
};

function setup(
  inputs: Partial<{
    filters: ListingsFilter;
    facets: ListingFacets | null;
    categories: ListingCategoryOption[];
    districts: ListingDistrict[];
    distanceActive: boolean;
  }> = {},
) {
  TestBed.configureTestingModule({
    imports: [BrowseFiltersPanelComponent, TranslateModule.forRoot()],
    providers: [
      provideMockStore({
        selectors: [
          { selector: selectListingsOriginCoords, value: null },
          { selector: selectListingsOriginSource, value: null },
          { selector: selectListingsOriginDenied, value: false },
        ],
      }),
      { provide: GeolocationService, useValue: { getCurrentPosition: vi.fn() } },
    ],
  });
  TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(BrowseFiltersPanelComponent);
  fixture.componentRef.setInput('filters', inputs.filters ?? EMPTY);
  fixture.componentRef.setInput('categories', inputs.categories ?? CATEGORIES);
  fixture.componentRef.setInput('districts', inputs.districts ?? DISTRICTS);
  fixture.componentRef.setInput('facets', inputs.facets === undefined ? FACETS : inputs.facets);
  fixture.componentRef.setInput('distanceActive', inputs.distanceActive ?? false);
  const patches: BrowseFilterPatch[] = [];
  fixture.componentInstance.patch.subscribe((p) => patches.push(p));
  let cleared = 0;
  fixture.componentInstance.clearAll.subscribe(() => cleared++);
  fixture.detectChanges();
  return { fixture, patches, cleared: () => cleared, el: fixture.nativeElement as HTMLElement };
}

const section = (el: HTMLElement, key: string) => el.querySelector<HTMLElement>(`[data-section="${key}"]`)!;
const badge = (el: HTMLElement, key: string) =>
  el.querySelector<HTMLElement>(`[data-testid="badge-${key}"]`)?.textContent?.trim() ?? null;
const rows = (el: HTMLElement, key: string) =>
  Array.from(section(el, key).querySelectorAll<HTMLElement>('.frow'));
const click = (fixture: ComponentFixture<unknown>, node: Element | null | undefined) => {
  (node as HTMLElement).click();
  fixture.detectChanges();
};

describe('BrowseFiltersPanelComponent — sections and header', () => {
  it('opens Category, Age, Price, District and Distance by default; Condition starts collapsed', () => {
    const { el } = setup();

    const open = (key: string) => section(el, key).querySelector('.fsec-h')!.getAttribute('aria-expanded');
    expect(['cat', 'age', 'price', 'dist', 'distance'].map(open)).toEqual(['true', 'true', 'true', 'true', 'true']);
    expect(open('cond')).toBe('false');
    expect(section(el, 'cond').querySelector('.fchip')).toBeNull();
  });

  it('toggles a section open and closed from its header', () => {
    const { fixture, el } = setup();

    click(fixture, section(el, 'cond').querySelector('.fsec-h'));
    expect(section(el, 'cond').querySelectorAll('.fchip')).toHaveLength(4);

    click(fixture, section(el, 'cat').querySelector('.fsec-h'));
    expect(section(el, 'cat').querySelector('.flist')).toBeNull();
  });

  it('shows no badges and no "Clear all" while nothing is selected', () => {
    const { el } = setup();

    expect(el.querySelector('[data-testid="total-badge"]')).toBeNull();
    expect(el.querySelector('[data-testid="clear-all"]')).toBeNull();
    expect(el.querySelectorAll('.fbadge')).toHaveLength(0);
  });

  it('shows a badge per section and a total in the header, and "Clear all" emits', () => {
    const { fixture, el, cleared } = setup({
      filters: {
        ...EMPTY,
        categoryIds: ['c1', 'c2'],
        ageGroups: ['0-12'],
        districtIds: ['d1'],
        conditions: ['New', 'Good', 'Fair'],
        minPrice: 1000,
      },
      distanceActive: true,
    });

    expect(badge(el, 'cat')).toBe('2');
    expect(badge(el, 'age')).toBe('1');
    expect(badge(el, 'dist')).toBe('1');
    expect(badge(el, 'cond')).toBe('3');
    expect(badge(el, 'price')).toBe('1');
    expect(badge(el, 'distance')).toBe('1');
    // 2 + 1 + 1 + 3 + 1 (price counts once, min and/or max) + 1 (distance)
    expect(el.querySelector('[data-testid="total-badge"]')!.textContent!.trim()).toBe('9');

    click(fixture, el.querySelector('[data-testid="clear-all"]'));
    expect(cleared()).toBe(1);
  });

  it('counts a price range as ONE selection, however many bounds are set', () => {
    const { el } = setup({ filters: { ...EMPTY, minPrice: 500, maxPrice: 2000 } });
    expect(badge(el, 'price')).toBe('1');
    expect(el.querySelector('[data-testid="total-badge"]')!.textContent!.trim()).toBe('1');
  });
});

describe('BrowseFiltersPanelComponent — categories', () => {
  it('lists the first 6 with facet counts, and "Show all N" reveals the rest', () => {
    const { fixture, el } = setup();

    expect(rows(el, 'cat')).toHaveLength(6);
    expect(rows(el, 'cat')[0].querySelector('.fcount')!.textContent!.trim()).toBe('7');
    const more = section(el, 'cat').querySelector('.tlink.more')!;
    expect(more.textContent).toContain('listings.browse.showAll');

    click(fixture, more);
    expect(rows(el, 'cat')).toHaveLength(9);
    expect(section(el, 'cat').querySelector('.tlink.more')!.textContent).toContain('listings.browse.showLess');
  });

  it('shows the category icon on its colour tile, with defaults for a category without one', () => {
    const { el } = setup();

    const tiles = rows(el, 'cat').map((r) => r.querySelector<HTMLElement>('.cico')!);
    expect(tiles[0].style.background).toContain('rgb(255, 224, 224)'); // #FFE0E0
    expect(tiles[0].querySelector('app-icon')).not.toBeNull();
    expect(tiles[1].querySelector('app-icon')).not.toBeNull();
  });

  it('keeps a zero-count facet visible but muted (and never hides a selected one beyond the first 6)', () => {
    const { el } = setup({ filters: { ...EMPTY, categoryIds: ['c8'] } });

    const all = rows(el, 'cat');
    // c1..c6 plus the selected c8 even though the list is collapsed.
    expect(all).toHaveLength(7);
    expect(all.some((r) => r.classList.contains('on'))).toBe(true);
    const zero = all.find((r) => r.querySelector('.fname')!.textContent!.includes('Category 3'))!;
    expect(zero.classList.contains('frow--empty')).toBe(true);
    expect(zero.querySelector('.fcount')!.textContent!.trim()).toBe('0');
    // a selected zero-count row is still listed and not muted
    const selected = all.find((r) => r.classList.contains('on'))!;
    expect(selected.classList.contains('frow--empty')).toBe(false);
  });

  it('renders no counts at all before the facets arrive (or after they fail)', () => {
    const { el } = setup({ facets: null });
    expect(section(el, 'cat').querySelector('.fcount')).toBeNull();
    expect(section(el, 'dist').querySelector('.fcount')).toBeNull();
  });

  it('toggling a row emits the whole new list (multi-select); un-checking removes only that id', () => {
    const { fixture, el, patches } = setup({ filters: { ...EMPTY, categoryIds: ['c1'] } });

    click(fixture, rows(el, 'cat')[1]);
    click(fixture, rows(el, 'cat')[0]);

    expect(patches).toEqual([{ categoryIds: ['c1', 'c2'] }, { categoryIds: [] }]);
    expect(rows(el, 'cat')[0].getAttribute('aria-checked')).toBe('true');
    expect(rows(el, 'cat')[0].getAttribute('role')).toBe('checkbox');
  });

  it('uses the localized category name (ADR-062 fallback to English)', () => {
    const { el } = setup();
    expect(rows(el, 'cat')[0].querySelector('.fname')!.textContent!.trim()).toBe('Category 1');
  });
});

describe('BrowseFiltersPanelComponent — child age and condition chips', () => {
  it("labels the age chips in years and toggles them multi-select", () => {
    const { fixture, el, patches } = setup({ filters: { ...EMPTY, ageGroups: ['0-12'] } });

    const chips = Array.from(section(el, 'age').querySelectorAll<HTMLElement>('.fchip'));
    expect(chips.map((c) => c.textContent!.trim())).toEqual([
      'listings.filters.ageGroups.g0_12',
      'listings.filters.ageGroups.g12_36',
      'listings.filters.ageGroups.g36_72',
      'listings.filters.ageGroups.g72_120',
      'listings.filters.ageGroups.g120_plus',
    ]);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');

    click(fixture, chips[4]);
    click(fixture, chips[0]);
    expect(patches).toEqual([{ ageGroups: ['0-12', '120+'] }, { ageGroups: [] }]);
  });

  it('offers exactly the ADR-042 conditions New / Like new / Good / Fair - never "Excellent"', () => {
    const { fixture, el, patches } = setup();
    click(fixture, section(el, 'cond').querySelector('.fsec-h'));

    const chips = Array.from(section(el, 'cond').querySelectorAll<HTMLElement>('.fchip'));
    expect(chips.map((c) => c.textContent!.trim())).toEqual([
      'listings.details.conditionValues.new',
      'listings.details.conditionValues.likeNew',
      'listings.details.conditionValues.good',
      'listings.details.conditionValues.fair',
    ]);
    expect(el.textContent).not.toMatch(/excellent/i);

    click(fixture, chips[1]);
    expect(patches).toEqual([{ conditions: ['LikeNew'] }]);
  });
});

describe('BrowseFiltersPanelComponent — districts', () => {
  it('lists the first 5 with counts and a "Show all N"', () => {
    const { fixture, el } = setup();

    expect(rows(el, 'dist')).toHaveLength(5);
    click(fixture, section(el, 'dist').querySelector('.tlink.more'));
    expect(rows(el, 'dist')).toHaveLength(7);
  });

  it('narrows as you type, hides "Show all" while searching, and says so when nothing matches', () => {
    const { fixture, el } = setup();
    const input = section(el, 'dist').querySelector<HTMLInputElement>('.dsearch input')!;

    input.value = 'nor';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows(el, 'dist').map((r) => r.querySelector('.fname')!.textContent!.trim())).toEqual(['Nor Nork']);
    expect(section(el, 'dist').querySelector('.tlink.more')).toBeNull();

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(rows(el, 'dist')).toHaveLength(0);
    const empty = el.querySelector('[data-testid="district-empty"]')!;
    expect(empty.textContent).toContain('listings.browse.districtNone');
  });

  it('toggles districts as a list and marks the selected one', () => {
    const { fixture, el, patches } = setup({ filters: { ...EMPTY, districtIds: ['d2'] } });

    click(fixture, rows(el, 'dist')[0]);
    expect(patches).toEqual([{ districtIds: ['d2', 'd1'] }]);
    expect(rows(el, 'dist')[1].classList.contains('on')).toBe(true);
  });
});

describe('BrowseFiltersPanelComponent — price per day', () => {
  const boxes = (el: HTMLElement) =>
    Array.from(section(el, 'price').querySelectorAll<HTMLInputElement>('.pbox__input'));
  const sliders = (el: HTMLElement) =>
    Array.from(section(el, 'price').querySelectorAll<HTMLInputElement>('.prange-i'));

  it('takes its bounds from the facets min/max (snapped to the 50 step) and shows them in the boxes', () => {
    const { el } = setup();

    const [lo, hi] = sliders(el);
    expect([lo.min, lo.max, hi.min, hi.max]).toEqual(['500', '10000', '500', '10000']);
    expect(boxes(el).map((b) => b.value)).toEqual(['500', '10000']);
    expect(section(el, 'price').textContent).toContain('listings.browse.priceMin');
    expect(section(el, 'price').textContent).toContain('listings.browse.priceMax');
  });

  it('shows the selected range in both slider and boxes, and highlights a set box', () => {
    const { el } = setup({ filters: { ...EMPTY, minPrice: 1500, maxPrice: 5000 } });

    expect(boxes(el).map((b) => b.value)).toEqual(['1500', '5000']);
    expect(sliders(el).map((s) => s.value)).toEqual(['1500', '5000']);
    expect(el.querySelectorAll('.pbox--set')).toHaveLength(2);
  });

  it('widens the bounds to include a selection outside them', () => {
    const { el } = setup({ filters: { ...EMPTY, maxPrice: 20000 } });
    expect(sliders(el)[0].max).toBe('20000');
  });

  it('typing a value in a box commits it; the bound itself means "no limit" (null)', () => {
    const { fixture, el, patches } = setup();

    const [min, max] = boxes(el);
    min.value = '1500';
    min.dispatchEvent(new Event('change'));
    max.value = '5000';
    max.dispatchEvent(new Event('change'));
    min.value = '500';
    min.dispatchEvent(new Event('change'));
    max.value = '10000';
    max.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(patches).toEqual([{ minPrice: 1500 }, { maxPrice: 5000 }, { minPrice: null }, { maxPrice: null }]);
  });

  it('keeps min <= max: a min above the max is clamped to it', () => {
    const { el, patches } = setup({ filters: { ...EMPTY, minPrice: 1000, maxPrice: 3000 } });

    const [min] = boxes(el);
    min.value = '8000';
    min.dispatchEvent(new Event('change'));

    expect(patches).toEqual([{ minPrice: 3000 }]);
    expect(min.value).toBe('3000');
  });

  it('commits a slider release as a patch', () => {
    const { el, patches } = setup();

    const [, hi] = sliders(el);
    hi.value = '4000';
    hi.dispatchEvent(new Event('input'));
    hi.dispatchEvent(new Event('change'));

    expect(patches).toEqual([{ maxPrice: 4000 }]);
  });

  it('falls back to 0-10,000 while the facets carry no prices', () => {
    const { el } = setup({ facets: null });
    const [lo] = sliders(el);
    expect([lo.min, lo.max]).toEqual(['0', '10000']);
  });
});

describe('BrowseFiltersPanelComponent — distance', () => {
  it('wraps the unchanged radius control and forwards its outputs', () => {
    const { fixture, el } = setup();
    expect(section(el, 'distance').querySelector('app-radius-origin-filter')).not.toBeNull();

    const radiusChanges: number[] = [];
    fixture.componentInstance.radiusMetersChange.subscribe((m) => radiusChanges.push(m));
    let origin = 0;
    fixture.componentInstance.originCleared.subscribe(() => origin++);

    // The wrapped control's own outputs reach the panel's outputs.
    const wrapped = fixture.debugElement.query((d) => d.name === 'app-radius-origin-filter');
    wrapped.triggerEventHandler('radiusMetersChange', 3000);
    wrapped.triggerEventHandler('originCleared', undefined);
    expect(radiusChanges).toEqual([3000]);
    expect(origin).toBe(1);
  });
});
