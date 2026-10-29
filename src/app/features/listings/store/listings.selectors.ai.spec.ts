import { makeListingPreview } from '../../../../testing/fixtures';
import {
  selectAiExplanation,
  selectAiHasSearched,
  selectAiNextPageContext,
  selectAiRanked,
  selectAiResultsActive,
} from './listings.selectors';
import { initialListingsAiState, initialListingsState, type ListingsState } from './listings.state';

function root(ai: Partial<ListingsState['ai']>, extra: Partial<ListingsState> = {}) {
  return {
    listings: { ...initialListingsState, ...extra, ai: { ...initialListingsAiState, ...ai } },
  };
}

describe('AI search selectors', () => {
  const searched = {
    mode: true,
    hasSearched: true,
    orderActive: true,
    ranked: true,
    intent: 'Outdoor play',
  };

  it('the explanation shows only while the order is ranked', () => {
    expect(selectAiExplanation(root(searched))).toBe('Outdoor play');
    expect(selectAiExplanation(root({ ...searched, ranked: false }))).toBeNull();
    expect(selectAiExplanation(root({ ...searched, orderActive: false }))).toBeNull();
    expect(selectAiExplanation(root({ ...searched, mode: false }))).toBeNull();
  });

  it('"most relevant first" / the divider follow ranked AI order', () => {
    expect(selectAiRanked(root(searched))).toBe(true);
    expect(selectAiRanked(root({ ...searched, ranked: false }))).toBe(false);
  });

  it('results are AI-ordered only while a search produced them and no other sort replaced the order', () => {
    expect(selectAiResultsActive(root(searched))).toBe(true);
    expect(selectAiResultsActive(root({ ...searched, orderActive: false }))).toBe(false);
    expect(selectAiResultsActive(root({ ...searched, hasSearched: false }))).toBe(false);
    // "Most relevant first" stays offered after the order was dropped
    expect(selectAiHasSearched(root({ ...searched, orderActive: false }))).toBe(true);
  });

  it('the next-page context carries every id shown so far and the page-1 applied filters', () => {
    const applied = {
      categoryId: null,
      ageGroup: null,
      maxPrice: 3000,
      districtIds: null,
      nearHome: false,
      radiusKm: null,
    };
    const ctx = selectAiNextPageContext(
      root(
        { ...searched, appliedFilters: applied, description: 'bike', epoch: 2 },
        {
          items: [makeListingPreview({ id: 'a' }), makeListingPreview({ id: 'b' })],
          page: 1,
          pageSize: 20,
          hasMore: true,
        },
      ),
    );
    expect(ctx).toMatchObject({
      active: true,
      description: 'bike',
      appliedFilters: applied,
      excludeIds: ['a', 'b'],
      page: 1,
      pageSize: 20,
      hasMore: true,
      epoch: 2,
    });
  });
});
