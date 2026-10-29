import type { AiSearchFilters } from './ai-search.model';
import {
  filtersToQueryParams,
  fromAiSearchFilters,
  sameFilters,
  toAiSearchFilters,
} from './ai-search.util';
import type { ListingsFilter } from './listings-filter.model';

const EMPTY: ListingsFilter = {
  query: null,
  city: null,
  categoryId: null,
  minPrice: null,
  maxPrice: null,
  ageGroup: null,
  radiusKm: null,
  districtIds: [],
};

const APPLIED: AiSearchFilters = {
  categoryId: 'cat-1',
  ageGroup: '36-72',
  maxPrice: 3000,
  districtIds: ['d-1', 'd-2'],
  nearHome: false,
  radiusKm: null,
};

describe('fromAiSearchFilters', () => {
  it('turns what the server applied into the page filters', () => {
    expect(fromAiSearchFilters(APPLIED)).toEqual({
      ...EMPTY,
      categoryId: 'cat-1',
      ageGroup: '36-72',
      maxPrice: 3000,
      districtIds: ['d-1', 'd-2'],
    });
  });

  it('maps nearHome onto the "From your home" radius (default 1 km)', () => {
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: null }).radiusKm).toBe(1);
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 2.5 }).radiusKm).toBe(2.5);
  });

  it('clamps the radius to the backend range and ignores radiusKm without nearHome', () => {
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 0.05 }).radiusKm).toBe(0.2);
    expect(fromAiSearchFilters({ ...APPLIED, nearHome: false, radiusKm: 3 }).radiusKm).toBeNull();
  });

  it('maps null districtIds to an empty list', () => {
    expect(fromAiSearchFilters({ ...APPLIED, districtIds: null }).districtIds).toEqual([]);
  });
});

describe('toAiSearchFilters', () => {
  it('sends the user-edited filters back; empty districts become null', () => {
    expect(toAiSearchFilters(EMPTY, null)).toEqual({
      categoryId: null,
      ageGroup: null,
      maxPrice: null,
      districtIds: null,
      nearHome: false,
      radiusKm: null,
    });
  });

  it('expresses a radius as nearHome only when it is measured from the home point', () => {
    const f = { ...EMPTY, radiusKm: 2 };
    expect(toAiSearchFilters(f, 'home')).toMatchObject({ nearHome: true, radiusKm: 2 });
    expect(toAiSearchFilters(f, 'geo')).toMatchObject({ nearHome: false, radiusKm: null });
    expect(toAiSearchFilters(f, null)).toMatchObject({ nearHome: false, radiusKm: null });
  });

  it('drops an age group the AI endpoint does not know', () => {
    expect(toAiSearchFilters({ ...EMPTY, ageGroup: 'teen' }, null).ageGroup).toBeNull();
    expect(toAiSearchFilters({ ...EMPTY, ageGroup: '120+' }, null).ageGroup).toBe('120+');
  });

  it('round-trips with fromAiSearchFilters', () => {
    const filters = fromAiSearchFilters({ ...APPLIED, nearHome: true, radiusKm: 1 });
    expect(fromAiSearchFilters(toAiSearchFilters(filters, 'home'))).toEqual(filters);
  });
});

describe('filtersToQueryParams / sameFilters', () => {
  it('serialises every filter key, with null for the empty ones', () => {
    expect(filtersToQueryParams({ ...EMPTY, maxPrice: 3000, districtIds: ['a', 'b'] })).toEqual({
      q: null,
      city: null,
      categoryId: null,
      ageGroup: null,
      minPrice: null,
      maxPrice: '3000',
      radiusKm: null,
      districtIds: 'a,b',
    });
  });

  it('treats null and empty string as the same value', () => {
    expect(sameFilters(EMPTY, { ...EMPTY, ageGroup: '' })).toBe(true);
  });

  it('detects a real difference', () => {
    expect(sameFilters(EMPTY, { ...EMPTY, maxPrice: 10 })).toBe(false);
    expect(
      sameFilters({ ...EMPTY, districtIds: ['a'] }, { ...EMPTY, districtIds: ['a', 'b'] }),
    ).toBe(false);
  });
});
