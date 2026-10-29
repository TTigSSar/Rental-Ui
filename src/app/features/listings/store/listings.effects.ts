import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  catchError,
  concatMap,
  distinctUntilChanged,
  EMPTY,
  map,
  of,
  switchMap,
  take,
  withLatestFrom,
  filter,
  tap,
  timer,
} from 'rxjs';

import { ApiErrorMapper } from '../../../api/api-error-mapper';
import * as AuthActions from '../../auth/store/auth.actions';
import { selectHomePoint } from '../../auth/store/auth.selectors';
import { selectFavoriteIds } from '../../favorites/store/favorites.selectors';
import { filtersToQueryParams, toAiSearchFilters } from '../models/ai-search.util';
import { ListingsApiService } from '../services/listings-api.service';
import * as ListingsActions from './listings.actions';
import {
  selectAiNextPageContext,
  selectAiFallbackResults,
  selectAiRequestContext,
  selectAiResultsActive,
  selectListingsFilters,
  selectListingsHasMore,
  selectListingsOriginCoords,
  selectListingsOriginSource,
  selectListingsPage,
  selectListingsPageSize,
} from './listings.selectors';
import { initialListingsState } from './listings.state';
import { getApiErrorCode } from '../../../api/api-error.model';

/** A filter/chip change re-ranks after this long, so several quick edits cost one request. */
export const AI_RERANK_DEBOUNCE_MS = 400;

@Injectable()
export class ListingsEffects {
  private readonly actions$ = inject(Actions);
  private readonly apiErrors = inject(ApiErrorMapper);
  private readonly store = inject(Store);
  private readonly listingsApi = inject(ListingsApiService);
  private readonly router = inject(Router);

  readonly loadListings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListings),
      withLatestFrom(
        this.store.select(selectListingsFilters),
        this.store.select(selectListingsPageSize),
        this.store.select(selectListingsOriginCoords),
      ),
      switchMap(([, filters, pageSize, originCoords]) =>
        this.listingsApi.getListings(filters, 1, pageSize, originCoords).pipe(
          map((result) =>
            ListingsActions.loadListingsSuccess({
              items: result.items,
              page: result.page,
              pageSize: result.pageSize,
              hasMore: result.hasMore,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingsFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly loadNextPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadNextPage),
      withLatestFrom(
        this.store.select(selectListingsHasMore),
        this.store.select(selectListingsPage),
        this.store.select(selectListingsFilters),
        this.store.select(selectListingsPageSize),
        this.store.select(selectListingsOriginCoords),
        this.store.select(selectAiResultsActive),
        this.store.select(selectAiFallbackResults),
      ),
      // AI-ordered results page through `loadAiNextPage$` instead; the AI-unavailable fallback
      // is a single page and never continues.
      filter(([, hasMore, , , , , aiActive, fallback]) => hasMore && !aiActive && !fallback),
      switchMap(([, , page, filters, pageSize, originCoords]) =>
        this.listingsApi.getListings(filters, page + 1, pageSize, originCoords).pipe(
          map((result) =>
            ListingsActions.loadListingsSuccess({
              items: result.items,
              page: result.page,
              pageSize: result.pageSize,
              hasMore: result.hasMore,
            }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingsFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * ADR-054. One stream for every page-1 AI request, so a newer search / re-rank cancels the
   * older timer or request ("the latest one wins"). A filter change waits 400 ms first; the
   * request context is read AFTER the wait so it carries the latest filters and epoch.
   * A first search sends `filters: null` (the server parses the description); a re-rank sends
   * the user's filters (no re-parse).
   */
  readonly aiFirstPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        ListingsActions.submitAiSearch,
        ListingsActions.aiFiltersChanged,
        ListingsActions.aiRerank,
      ),
      switchMap((action) => {
        const isSearch = action.type === ListingsActions.submitAiSearch.type;
        const wait$ =
          action.type === ListingsActions.aiFiltersChanged.type
            ? timer(AI_RERANK_DEBOUNCE_MS)
            : of(0);
        return wait$.pipe(
          switchMap(() => this.store.select(selectAiRequestContext).pipe(take(1))),
          switchMap((ctx) =>
            this.listingsApi
              .aiSearch({
                description: ctx.description,
                filters: isSearch ? null : toAiSearchFilters(ctx.filters, ctx.originSource),
                page: 1,
                pageSize: ctx.pageSize,
                excludeIds: null,
              })
              .pipe(
                map((response) =>
                  ListingsActions.aiSearchSuccess({
                    kind: isSearch ? 'search' : 'rerank',
                    response,
                    epoch: ctx.epoch,
                  }),
                ),
                catchError((error: unknown) =>
                  of(
                    ListingsActions.aiSearchFailure({
                      error: this.apiErrors.message(error),
                      errorCode: getApiErrorCode(error),
                      epoch: ctx.epoch,
                    }),
                  ),
                ),
              ),
          ),
        );
      }),
    ),
  );

  /** Page 2+ of AI-ordered results: the server makes no model call; it needs the page-1
   *  `appliedFilters` and every id shown so far. */
  readonly loadAiNextPage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadNextPage),
      withLatestFrom(this.store.select(selectAiNextPageContext)),
      filter(([, ctx]) => ctx.active && ctx.hasMore && ctx.appliedFilters !== null),
      switchMap(([, ctx]) =>
        this.listingsApi
          .aiSearch({
            description: ctx.description,
            filters: ctx.appliedFilters,
            page: ctx.page + 1,
            pageSize: ctx.pageSize,
            excludeIds: ctx.excludeIds,
          })
          .pipe(
            map((response) =>
              ListingsActions.aiSearchSuccess({ kind: 'page', response, epoch: ctx.epoch }),
            ),
            catchError((error: unknown) =>
              of(
                ListingsActions.aiSearchFailure({
                  error: this.apiErrors.message(error),
                  errorCode: getApiErrorCode(error),
                  epoch: ctx.epoch,
                }),
              ),
            ),
          ),
      ),
    ),
  );

  /** Choosing another sort drops the AI order: the ordinary catalogue loads with the same filters. */
  readonly dropAiOrder$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.dropAiOrder),
      map(() => ListingsActions.loadListings()),
    ),
  );

  /**
   * The AI-applied filters become the page's filters in the reducer; this mirrors them into the
   * URL (the filter controls and chips are URL-driven), next to `ai=1`. The description never
   * goes to the URL. The page's query-param subscription sees equal filters and does nothing.
   */
  readonly syncAiFiltersToUrl$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ListingsActions.aiSearchSuccess),
        filter(({ kind }) => kind !== 'page'),
        withLatestFrom(this.store.select(selectListingsFilters)),
        tap(([{ response }, filters]) => {
          // `aiUnavailable`: the switch has been turned off (reducer), so `ai` leaves the URL.
          // The description is never written to the URL (no `q`).
          void this.router.navigate([], {
            queryParams: { ...filtersToQueryParams(filters), ai: response.aiUnavailable ? null : '1' },
            queryParamsHandling: 'merge',
          });
        }),
      ),
    { dispatch: false },
  );

  /** "Near me" resolves to the user's HOME point: make the distance filter measure from it. */
  readonly aiNearHomeOrigin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.aiSearchSuccess),
      filter(({ kind, response }) => kind !== 'page' && response.appliedFilters.nearHome),
      withLatestFrom(
        this.store.select(selectHomePoint),
        this.store.select(selectListingsOriginSource),
      ),
      filter(([, homePoint, source]) => homePoint !== null && source !== 'home'),
      map(([, homePoint]) =>
        ListingsActions.setOriginCoords({
          coords: { lat: homePoint!.latitude, lng: homePoint!.longitude },
          source: 'home',
        }),
      ),
    ),
  );

  readonly loadAiStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadAiStatus),
      switchMap(() =>
        this.listingsApi.aiSearchStatus().pipe(
          map((status) => ListingsActions.loadAiStatusSuccess({ status })),
          catchError(() => of(ListingsActions.loadAiStatusFailure())),
        ),
      ),
    ),
  );

  readonly loadMapPins$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadMapPins),
      withLatestFrom(
        this.store.select(selectListingsFilters),
        this.store.select(selectListingsOriginCoords),
      ),
      // switchMap (not mergeMap/concatMap): the map re-dispatches on every
      // pan/zoom, so a stale in-flight viewport response must be cancelled,
      // not raced against a newer one.
      switchMap(([{ bounds, scope }, filters, originCoords]) => {
        // `scope: 'all'` (listing-detail maps) ignores whatever
        // filter/origin is currently in the store — a listing-detail page
        // must show every toy, not whatever the visitor last searched on
        // `/listings`. Reads the REDUCER's own initial (empty) filter,
        // rather than hand-building one here, so this can never drift from
        // what "no filter" actually means.
        const effectiveFilters = scope === 'all' ? initialListingsState.filters : filters;
        const effectiveOrigin = scope === 'all' ? null : originCoords;
        return this.listingsApi.getMapPins(effectiveFilters, bounds, effectiveOrigin).pipe(
          map((result) => ListingsActions.loadMapPinsSuccess({ result })),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadMapPinsFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        );
      }),
    ),
  );

  readonly loadListingDetails$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListingDetails),
      switchMap(({ id }) =>
        this.listingsApi.getListingById(id).pipe(
          map((listing) =>
            ListingsActions.loadListingDetailsSuccess({ listing }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingDetailsFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly persistFavoriteToggle$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.toggleFavoriteOptimistic),
      concatMap(({ listingId }) =>
        this.store.select(selectFavoriteIds).pipe(
          take(1),
          switchMap((favoriteIds) => {
            const nowFavorited = favoriteIds.has(listingId);
            const request$ = nowFavorited
              ? this.listingsApi.addToFavorites(listingId)
              : this.listingsApi.removeFromFavorites(listingId);
            return request$.pipe(
              switchMap(() => EMPTY),
              catchError(() =>
                of(
                  ListingsActions.toggleFavoriteRollback({
                    listingId,
                    isFavorite: !nowFavorited,
                  }),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );

  readonly loadListingCategories$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.loadListingCategories),
      switchMap(() =>
        this.listingsApi.getListingCategories().pipe(
          map((categories) =>
            ListingsActions.loadListingCategoriesSuccess({ categories }),
          ),
          catchError((error: unknown) =>
            of(
              ListingsActions.loadListingCategoriesFailure({
                error: this.apiErrors.message(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly createListing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.createListing),
      concatMap(({ payload, files }) =>
        this.listingsApi.createListing(payload).pipe(
          switchMap((response) => {
            if (files.length === 0) {
              return of(
                ListingsActions.createListingSuccess({
                  response,
                  imageUploadError: null,
                }),
              );
            }

            // Image upload failure must NOT prevent success/redirect — the
            // listing was already created on the backend. Stream progress
            // actions, then capture any error as a non-blocking warning so the
            // user is still redirected to My Toys (and can retry the upload).
            return this.listingsApi.uploadListingImages(response.id, files).pipe(
              map((event) =>
                event.kind === 'progress'
                  ? ListingsActions.setImageUploadProgress({
                      progress: event.percent,
                    })
                  : ListingsActions.createListingSuccess({
                      response,
                      imageUploadError: null,
                    }),
              ),
              catchError((err: unknown) =>
                of(
                  ListingsActions.createListingSuccess({
                    response,
                    imageUploadError: this.apiErrors.message(err),
                  }),
                ),
              ),
            );
          }),
          catchError((error: unknown) =>
            // Only listing-creation failures reach this branch.
            of(
              ListingsActions.createListingFailure({
                error: this.apiErrors.message(error),
                errorCode: getApiErrorCode(error),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  readonly retryImageUpload$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ListingsActions.retryImageUpload),
      concatMap(({ listingId, files }) =>
        this.listingsApi.uploadListingImages(listingId, files).pipe(
          map((event) =>
            event.kind === 'progress'
              ? ListingsActions.setImageUploadProgress({
                  progress: event.percent,
                })
              : ListingsActions.retryImageUploadSuccess(),
          ),
          catchError((err: unknown) =>
            of(
              ListingsActions.retryImageUploadFailure({
                error: this.apiErrors.message(err),
              }),
            ),
          ),
        ),
      ),
    ),
  );

  /**
   * Home-point model: for a signed-in user who has a home point, "From your
   * home" is the DEFAULT origin the radius filter measures from.
   *
   * Three properties make this safe, and all three are load-bearing:
   *
   * 1. **It never overrides a deliberate choice.** The guard is
   *    `source === null || source === 'home'` — if the renter has already
   *    picked "Use my location" (`'geo'`) or dropped a point (`'manual'`),
   *    this is a no-op forever after. A profile refresh (`loadCurrentUser`
   *    fires on every boot and after several mutations) must not silently
   *    yank the origin back to home under a renter who is mid-search.
   *    `source === 'home'` is allowed through so MOVING the home point
   *    (`updateHomePointSuccess`) actually re-targets a home-based search.
   * 2. **It sends nothing.** Setting the origin does not make a request, and
   *    `ListingsApiService.buildSharedFilterParams` emits `originLat`/
   *    `originLng` only alongside a `radiusKm` the renter chose — so the home
   *    coordinates stay on the device until the renter asks for a distance
   *    filter (product decision, Tigran 2026-10-05).
   * 3. **It is session-only.** `originCoords`/`originSource` live in
   *    `ListingsState`, which is never persisted or URL-serialized (Maps
   *    P2-3), so the home point is not written to storage by this — matching
   *    the deliberate "no client-side copy of the home point" rule in
   *    `AuthActions`' own home-point section.
   *
   * The precise (not public) coordinate is used: it never leaves the device
   * un-coarsened (see the seam in `ListingsApiService`), and using the fuzzed
   * pair would make the renter's own distances wrong by up to a cell width
   * for no privacy gain against themselves.
   *
   * **Driven off the STORE, not off `loadCurrentUserSuccess`/
   * `updateHomePointSuccess` directly** — and that is a correction, not a
   * preference. These effects are route-scoped
   * (`provideEffects(ListingsEffects)` in each feature's `routes.ts`), so on
   * a cold load straight onto `/listings` the lazy route chunk registers them
   * only after the router resolves, by which time `/api/auth/me` has usually
   * already answered and `loadCurrentUserSuccess` is long gone. An
   * action-only version therefore missed its trigger on essentially EVERY
   * first load — a live walk against the real API showed all three origin
   * rows unselected and the radius still reading "set a point first", which
   * is the one state this whole feature exists to replace. It was not a rare
   * race; it was the normal path.
   *
   * `store.select` fixes it because it emits the CURRENT value on
   * subscription as well as on every later change, so the effect covers both
   * named actions (each of which replaces `user`, hence re-emits) and the
   * cold-boot case, with one code path instead of two.
   *
   * `distinctUntilChanged` on the coordinate pair earns its place twice: it
   * stops a redundant dispatch on every profile refresh (`loadCurrentUser`
   * runs on each boot and after several mutations, handing back an equal
   * point in a new object), and it makes "Remove" stick — after
   * `clearOrigin` the source is `null` again, so without it the next profile
   * refresh would quietly re-add the origin the renter had just removed.
   */
  readonly defaultOriginToHomePoint$ = createEffect(() =>
    this.store.select(selectHomePoint).pipe(
      distinctUntilChanged(
        (a, b) => a?.latitude === b?.latitude && a?.longitude === b?.longitude,
      ),
      withLatestFrom(this.store.select(selectListingsOriginSource)),
      filter(
        ([homePoint, source]) =>
          homePoint !== null && (source === null || source === 'home'),
      ),
      map(([homePoint]) =>
        ListingsActions.setOriginCoords({
          coords: { lat: homePoint!.latitude, lng: homePoint!.longitude },
          source: 'home',
        }),
      ),
    ),
  );

  /**
   * The mirror of `defaultOriginToHomePoint$`: a `'home'` origin outlives
   * neither the session it belongs to nor the point it points at.
   *
   * - `logout` — the origin is one user's home coordinate; leaving it in a
   *   session-scoped slice after sign-out would keep measuring the next
   *   (anonymous) visitor's distances from the previous user's home, and
   *   would keep sending it the moment a radius was picked.
   * - `clearHomePointSuccess` — the user deleted the point this origin IS.
   *   Not named in the task spec; included because the alternative is an
   *   origin labelled "From your home" for a home that no longer exists, and
   *   the radius filter would hide the row it is selected by
   *   (`hasHomePoint()` goes false) while still filtering by it.
   *
   * Gated on `source === 'home'` so neither action disturbs a `'geo'`/
   * `'manual'` origin the visitor set themselves — logging out is not a
   * reason to forget a point they dropped on the map.
   *
   * `clearOrigin` deliberately does NOT null `filters.radiusKm` (see that
   * action's own doc comment — the page owns the URL). With no origin, the
   * seam omits the distance params entirely and the "active filter" chip is
   * already gated on `originCoords !== null`, so a leftover `?radiusKm=` in
   * the URL is inert rather than a filter that claims to apply and doesn't.
   */
  readonly clearHomeOrigin$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AuthActions.logout, AuthActions.clearHomePointSuccess),
      withLatestFrom(this.store.select(selectListingsOriginSource)),
      filter(([, source]) => source === 'home'),
      map(() => ListingsActions.clearOrigin()),
    ),
  );
}
