import * as ListingsActions from './listings.actions';
import { listingsReducer } from './listings.reducer';
import { initialListingsState, type ListingsState } from './listings.state';

// Trello #80: `clearOrigin` is the only way to unset the renter's cached
// reference point — this reducer test is the minimal proof that it resets
// exactly the origin slice and nothing else (`filters`, in particular,
// which the widget/parents are careful never to touch from this action).
describe('listingsReducer — clearOrigin (Trello #80)', () => {
  it('resets originCoords/originSource/originDenied and leaves filters untouched', () => {
    const state: ListingsState = {
      ...initialListingsState,
      originCoords: { lat: 40.18, lng: 44.51 },
      originSource: 'manual',
      originDenied: true,
      filters: { ...initialListingsState.filters, radiusKm: 3, districtIds: ['d1'] },
    };

    const next = listingsReducer(state, ListingsActions.clearOrigin());

    expect(next.originCoords).toBeNull();
    expect(next.originSource).toBeNull();
    expect(next.originDenied).toBe(false);
    expect(next.filters).toEqual(state.filters);
  });
});
