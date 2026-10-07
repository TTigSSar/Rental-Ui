import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject, from, of, throwError, type Observable } from 'rxjs';
import type { Action } from '@ngrx/store';

import { actionsHarness, collect } from '../../../../testing/ngrx.helpers';
import {
  makeHomePoint,
  makeListingMapPin,
  makeListingPreview,
  makeUser,
} from '../../../../testing/fixtures';
import * as AuthActions from '../../auth/store/auth.actions';
import { selectHomePoint } from '../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../favorites/store/favorites.selectors';
import type { ListingMapPinsResult } from '../models/listing-map-pin.model';
import type { ListingsFilter } from '../models/listings-filter.model';
import { ListingsApiService } from '../services/listings-api.service';
import * as ListingsActions from './listings.actions';
import { ListingsEffects } from './listings.effects';
import {
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsOriginCoords,
  selectListingsOriginSource,
  selectListingsPage,
  selectListingsPageSize,
} from './listings.selectors';
import { initialListingsState } from './listings.state';

function setup(api: Partial<ListingsApiService> = {}) {
  const harness = actionsHarness();
  TestBed.configureTestingModule({
    providers: [
      ListingsEffects,
      harness.provider,
      provideMockStore(),
      { provide: ListingsApiService, useValue: api },
    ],
  });
  const store = TestBed.inject(MockStore);
  store.overrideSelector(selectListingsFilters, {} as ListingsFilter);
  store.overrideSelector(selectListingsPage, 1);
  store.overrideSelector(selectListingsPageSize, 20);
  store.overrideSelector(selectListingsHasMore, true);
  store.overrideSelector(selectListingsOriginCoords, null);
  store.overrideSelector(selectListingsOriginSource, null);
  store.overrideSelector(selectHomePoint, null);
  store.overrideSelector(selectFavoriteIds, new Set<string>());
  return { harness, store, effects: TestBed.inject(ListingsEffects) };
}

describe('ListingsEffects', () => {
  describe('loadNextPage$ pagination guard', () => {
    it('fetches the next page when more results exist', async () => {
      const getListings = vi.fn().mockReturnValue(
        of({ items: [makeListingPreview()], page: 2, pageSize: 20, hasMore: false }),
      );
      const { harness, store, effects } = setup({ getListings });
      store.overrideSelector(selectListingsHasMore, true);
      store.overrideSelector(selectListingsPage, 1);
      store.refreshState();

      const result = collect(effects.loadNextPage$);
      harness.send(ListingsActions.loadNextPage());
      harness.complete();

      const emitted = await result;
      expect(emitted).toHaveLength(1);
      expect(getListings).toHaveBeenCalledWith(expect.anything(), 2, 20, null);
    });

    it('does nothing when there are no more pages', async () => {
      const getListings = vi.fn();
      const { harness, store, effects } = setup({ getListings });
      store.overrideSelector(selectListingsHasMore, false);
      store.refreshState();

      const result = collect(effects.loadNextPage$);
      harness.send(ListingsActions.loadNextPage());
      harness.complete();

      expect(await result).toEqual([]);
      expect(getListings).not.toHaveBeenCalled();
    });
  });

  describe('createListing$ image-upload resilience', () => {
    const payload = { title: 'Toy' } as never;
    const response = { id: 'L1' } as never;

    it('succeeds with no image error when there are no files', async () => {
      const createListing = vi.fn().mockReturnValue(of(response));
      const uploadListingImages = vi.fn();
      const { harness, effects } = setup({ createListing, uploadListingImages });

      const result = collect(effects.createListing$);
      harness.send(ListingsActions.createListing({ payload, files: [] }));
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.createListingSuccess({ response, imageUploadError: null }),
      ]);
      expect(uploadListingImages).not.toHaveBeenCalled();
    });

    it('succeeds with no image error when files upload cleanly', async () => {
      const file = new File(['x'], 'toy.png');
      const { harness, effects } = setup({
        createListing: vi.fn().mockReturnValue(of(response)),
        uploadListingImages: vi
          .fn()
          .mockReturnValue(of({ kind: 'complete', images: [] })),
      });

      const result = collect(effects.createListing$);
      harness.send(ListingsActions.createListing({ payload, files: [file] }));
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.createListingSuccess({ response, imageUploadError: null }),
      ]);
    });

    it('still succeeds (with a captured warning) when the image upload fails', async () => {
      // The listing already exists on the backend, so an upload failure must NOT
      // become createListingFailure — it surfaces as a non-blocking warning.
      const file = new File(['x'], 'toy.png');
      const { harness, effects } = setup({
        createListing: vi.fn().mockReturnValue(of(response)),
        uploadListingImages: vi.fn().mockReturnValue(throwError(() => new Error('upload too large'))),
      });

      const result = collect(effects.createListing$);
      harness.send(ListingsActions.createListing({ payload, files: [file] }));
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.createListingSuccess({ response, imageUploadError: 'upload too large' }),
      ]);
    });

    it('streams upload progress before success', async () => {
      const file = new File(['x'], 'toy.png');
      const { harness, effects } = setup({
        createListing: vi.fn().mockReturnValue(of(response)),
        uploadListingImages: vi.fn().mockReturnValue(
          from([
            { kind: 'progress', percent: 40 },
            { kind: 'complete', images: [] },
          ]),
        ),
      });

      const result = collect(effects.createListing$);
      harness.send(ListingsActions.createListing({ payload, files: [file] }));
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.setImageUploadProgress({ progress: 40 }),
        ListingsActions.createListingSuccess({ response, imageUploadError: null }),
      ]);
    });

    it('fails when the listing creation itself fails', async () => {
      const { harness, effects } = setup({
        createListing: vi.fn().mockReturnValue(throwError(() => new Error('invalid listing'))),
      });

      const result = collect(effects.createListing$);
      harness.send(ListingsActions.createListing({ payload, files: [] }));
      harness.complete();

      expect(await result).toEqual([
        // `errorCode` is null here: this failure carries no ProblemDetails
        // body, so `getApiErrorCode` finds nothing. A 409
        // `listing.home_point_required` is the case where it is populated —
        // see the wizard's home-point gate.
        ListingsActions.createListingFailure({ error: 'invalid listing', errorCode: null }),
      ]);
    });
  });

  describe('retryImageUpload$', () => {
    it('re-uploads and emits success', async () => {
      const file = new File(['x'], 'toy.png');
      const { harness, effects } = setup({
        uploadListingImages: vi
          .fn()
          .mockReturnValue(of({ kind: 'complete', images: [] })),
      });

      const result = collect(effects.retryImageUpload$);
      harness.send(
        ListingsActions.retryImageUpload({ listingId: 'L1', files: [file] }),
      );
      harness.complete();

      expect(await result).toEqual([ListingsActions.retryImageUploadSuccess()]);
    });

    it('emits failure when the retry upload fails', async () => {
      const file = new File(['x'], 'toy.png');
      const { harness, effects } = setup({
        uploadListingImages: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('still failing'))),
      });

      const result = collect(effects.retryImageUpload$);
      harness.send(
        ListingsActions.retryImageUpload({ listingId: 'L1', files: [file] }),
      );
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.retryImageUploadFailure({ error: 'still failing' }),
      ]);
    });
  });

  describe('loadMapPins$', () => {
    it('emits success with the normalized result', async () => {
      const result: ListingMapPinsResult = {
        items: [makeListingMapPin()],
        isTruncated: false,
      };
      const getMapPins = vi.fn().mockReturnValue(of(result));
      const { harness, effects } = setup({ getMapPins });

      const collected = collect(effects.loadMapPins$);
      harness.send(ListingsActions.loadMapPins({ bounds: null, scope: 'filtered' }));
      harness.complete();

      expect(await collected).toEqual([ListingsActions.loadMapPinsSuccess({ result })]);
      expect(getMapPins).toHaveBeenCalledWith(expect.anything(), null, null);
    });

    it('emits failure when the request errors', async () => {
      const getMapPins = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
      const { harness, effects } = setup({ getMapPins });

      const collected = collect(effects.loadMapPins$);
      harness.send(ListingsActions.loadMapPins({ bounds: null, scope: 'filtered' }));
      harness.complete();

      expect(await collected).toEqual([
        ListingsActions.loadMapPinsFailure({ error: 'boom' }),
      ]);
    });

    it('cancels a stale in-flight request when a second dispatch arrives (switchMap semantics)', async () => {
      const firstResponse$ = new Subject<ListingMapPinsResult>();
      const secondResult: ListingMapPinsResult = {
        items: [makeListingMapPin({ id: 'second' })],
        isTruncated: false,
      };
      const getMapPins = vi
        .fn()
        .mockReturnValueOnce(firstResponse$.asObservable())
        .mockReturnValueOnce(of(secondResult));
      const { harness, effects } = setup({ getMapPins });

      const collected = collect(effects.loadMapPins$);
      harness.send(ListingsActions.loadMapPins({ bounds: null, scope: 'filtered' }));
      harness.send(
        ListingsActions.loadMapPins({
          bounds: { minLat: 1, maxLat: 2, minLng: 3, maxLng: 4 },
          scope: 'filtered',
        }),
      );
      harness.complete();

      // The first request resolves AFTER the second dispatch — switchMap must
      // have already unsubscribed from it, so this emission is dropped.
      firstResponse$.next({ items: [makeListingMapPin({ id: 'stale' })], isTruncated: false });
      firstResponse$.complete();

      expect(await collected).toEqual([
        ListingsActions.loadMapPinsSuccess({ result: secondResult }),
      ]);
      expect(getMapPins).toHaveBeenCalledTimes(2);
    });

    it('scope: "all" ignores the store\'s current filters/originCoords, fetching with the reducer\'s empty filter and no origin', async () => {
      const result: ListingMapPinsResult = { items: [makeListingMapPin()], isTruncated: false };
      const getMapPins = vi.fn().mockReturnValue(of(result));
      const { harness, store, effects } = setup({ getMapPins });
      // A non-empty filter/origin currently in the store — must NOT reach
      // `getMapPins` for a `scope: 'all'` request, which is the whole point
      // of the scope: a listing-detail page must show every toy regardless
      // of whatever the visitor last searched on `/listings`.
      store.overrideSelector(selectListingsFilters, {
        query: 'lego',
      } as unknown as ListingsFilter);
      store.overrideSelector(selectListingsOriginCoords, { lat: 40.1, lng: 44.5 });
      store.refreshState();

      const collected = collect(effects.loadMapPins$);
      harness.send(ListingsActions.loadMapPins({ bounds: null, scope: 'all' }));
      harness.complete();

      expect(await collected).toEqual([ListingsActions.loadMapPinsSuccess({ result })]);
      expect(getMapPins).toHaveBeenCalledWith(initialListingsState.filters, null, null);
    });
  });

  describe('persistFavoriteToggle$', () => {
    it('rolls back to the previous state when the favorite request fails', async () => {
      // favoriteIds now contains the listing => it was just favorited; on failure we
      // must roll back to not-favorited.
      const { harness, store, effects } = setup({
        addToFavorites: vi.fn().mockReturnValue(throwError(() => new Error('x'))),
        removeFromFavorites: vi.fn(),
      });
      store.overrideSelector(selectFavoriteIds, new Set(['L1']));
      store.refreshState();

      const result = collect(effects.persistFavoriteToggle$);
      harness.send(ListingsActions.toggleFavoriteOptimistic({ listingId: 'L1' }));
      harness.complete();

      expect(await result).toEqual([
        ListingsActions.toggleFavoriteRollback({ listingId: 'L1', isFavorite: false }),
      ]);
    });

    it('emits nothing on a successful toggle', async () => {
      const { harness, store, effects } = setup({
        addToFavorites: vi.fn().mockReturnValue(of(undefined)),
        removeFromFavorites: vi.fn().mockReturnValue(of(undefined)),
      });
      store.overrideSelector(selectFavoriteIds, new Set(['L1']));
      store.refreshState();

      const result = collect(effects.persistFavoriteToggle$);
      harness.send(ListingsActions.toggleFavoriteOptimistic({ listingId: 'L1' }));
      harness.complete();

      expect(await result).toEqual([]);
    });
  });

  // ── Home-point model: "From your home" as the default radius origin ──
  //
  // Driven off the STORE, not off an action, so these tests set up the state
  // and then simply subscribe — there is no `harness.send()` here, and that
  // is the point. An earlier action-driven version passed action-shaped tests
  // while failing on every real cold load of `/listings`, because the auth
  // action had already fired before these route-scoped effects registered
  // (found by a live walk, not by this suite). Subscribing to the effect IS
  // the regression test for that: it only emits if the current store value is
  // enough on its own.
  describe('defaultOriginToHomePoint$', () => {
    const homePoint = makeHomePoint();

    function withState(
      source: 'geo' | 'manual' | 'home' | null,
      point: ReturnType<typeof makeHomePoint> | null = homePoint,
    ) {
      const ctx = setup();
      ctx.store.overrideSelector(selectHomePoint, point);
      ctx.store.overrideSelector(selectListingsOriginSource, source);
      ctx.store.refreshState();
      return ctx;
    }

    /**
     * `collect()` can't be used here: it relies on `toArray()`, which needs
     * the SOURCE to complete, and this effect's source is a store selector
     * that never does. `MockStore` emits synchronously on subscribe and on
     * `refreshState()`, so a plain subscription collecting into an array is
     * both sufficient and exact — no timers, no flush.
     */
    function collectSync(effect$: Observable<Action>) {
      const emitted: Action[] = [];
      const subscription = effect$.subscribe((action) => emitted.push(action));
      return { emitted, stop: () => subscription.unsubscribe() };
    }

    it('sets the origin from the store on subscription, with no action needed (cold-load path)', () => {
      const { effects } = withState(null);

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      stop();

      expect(emitted).toEqual([
        ListingsActions.setOriginCoords({
          // The EXACT pair, never the fuzzed public one — it is the renter's
          // own point, and the API seam is what coarsens it on the way out.
          coords: { lat: homePoint.latitude, lng: homePoint.longitude },
          source: 'home',
        }),
      ]);
    });

    it('re-targets an existing home origin when the user MOVES their home point', () => {
      const moved = makeHomePoint({ latitude: 40.21, longitude: 44.49, district: null });
      const { store, effects } = withState('home');

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      store.overrideSelector(selectHomePoint, moved);
      store.refreshState();
      stop();

      expect(emitted.at(-1)).toEqual(
        ListingsActions.setOriginCoords({
          coords: { lat: moved.latitude, lng: moved.longitude },
          source: 'home',
        }),
      );
    });

    // The guard that matters most: the home point is re-read on every boot
    // and after several mutations, and it must never yank the origin out from
    // under a renter who deliberately chose one.
    it('NEVER overrides a geo origin the renter chose', () => {
      const { effects } = withState('geo');

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      stop();

      expect(emitted).toEqual([]);
    });

    it('NEVER overrides a manual origin the renter dropped on the map', () => {
      const { effects } = withState('manual');

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      stop();

      expect(emitted).toEqual([]);
    });

    it('does nothing for a user with no home point', () => {
      const { effects } = withState(null, null);

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      stop();

      expect(emitted).toEqual([]);
    });

    // "Remove" has to stick. Without the `distinctUntilChanged` on the
    // coordinate pair, the next profile refresh (an equal point in a fresh
    // object) would silently re-add the origin the renter just removed.
    it('does not re-add the origin when an unchanged home point is re-read after a clear', () => {
      const { store, effects } = withState(null);

      const { emitted, stop } = collectSync(effects.defaultOriginToHomePoint$);
      // The first emission is the legitimate default. Now simulate "Remove"
      // followed by a profile refresh carrying an EQUAL point in a new object.
      store.overrideSelector(selectListingsOriginSource, null);
      store.overrideSelector(selectHomePoint, makeHomePoint());
      store.refreshState();
      stop();

      expect(emitted).toHaveLength(1);
    });
  });

  describe('clearHomeOrigin$', () => {
    it('clears a home origin on logout', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectListingsOriginSource, 'home');
      store.refreshState();

      const result = collect(effects.clearHomeOrigin$);
      harness.send(AuthActions.logout());
      harness.complete();

      expect(await result).toEqual([ListingsActions.clearOrigin()]);
    });

    it('clears a home origin when the home point is deleted', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectListingsOriginSource, 'home');
      store.refreshState();

      const result = collect(effects.clearHomeOrigin$);
      harness.send(AuthActions.clearHomePointSuccess({ user: makeUser() }));
      harness.complete();

      expect(await result).toEqual([ListingsActions.clearOrigin()]);
    });

    it('leaves a geo origin alone on logout — signing out is not a reason to forget a point the visitor set', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectListingsOriginSource, 'geo');
      store.refreshState();

      const result = collect(effects.clearHomeOrigin$);
      harness.send(AuthActions.logout());
      harness.complete();

      expect(await result).toEqual([]);
    });

    it('leaves a manual origin alone on logout', async () => {
      const { harness, store, effects } = setup();
      store.overrideSelector(selectListingsOriginSource, 'manual');
      store.refreshState();

      const result = collect(effects.clearHomeOrigin$);
      harness.send(AuthActions.logout());
      harness.complete();

      expect(await result).toEqual([]);
    });
  });
});
