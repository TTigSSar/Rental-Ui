import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import type { HomePoint } from '../../../auth/models/auth.models';
import * as AuthActions from '../../../auth/store/auth.actions';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import type { AuthState } from '../../../auth/store/auth.state';
import { myListingsFeatureKey } from '../../../my-listings/store/my-listings.reducer';
import { initialMyListingsState } from '../../../my-listings/store/my-listings.state';
import type { HomePointSelection } from '../../../../shared/ui/home-point-map/home-point-map.model';
import { HomePointCardComponent } from './home-point-card.component';

/** `app-map` dynamic-imports the real `leaflet`; stubbed as everywhere else. */
vi.mock('leaflet', () => ({
  map: vi.fn((_el: HTMLElement, options: { center: [number, number] }) => ({
    setView: vi.fn(),
    on: vi.fn(),
    getCenter: vi.fn(() => ({ lat: options.center[0], lng: options.center[1] })),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  marker: vi.fn(() => ({ addTo: vi.fn() })),
  circle: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

const KENTRON = {
  id: 'd1111111-1111-1111-1111-111111111111',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

const ARABKIR = {
  id: 'd2222222-2222-2222-2222-222222222222',
  code: 'arabkir',
  nameEn: 'Arabkir',
  nameHy: 'Արաբկիր',
  nameRu: 'Арабкир',
};

const HOME_POINT: HomePoint = {
  latitude: 40.183332,
  longitude: 44.514999,
  publicLatitude: 40.1835,
  publicLongitude: 44.5152,
  district: KENTRON,
  updatedAt: '2026-09-27T20:03:21.000Z',
};

const NEW_SELECTION: HomePointSelection = {
  center: { lat: 40.21, lng: 44.49 },
  district: ARABKIR,
  resolving: false,
  outsideYerevan: false,
  deliberate: true,
  geoState: 'idle',
  lowAccuracyMeters: null,
  canConfirm: true,
};

/**
 * `listingsLoading` / `listingsError` are NOT incidental: `toyCount: 0` with a
 * settled load means "this owner has no toys", and `toyCount: 0` with the load
 * still in flight means "we do not know yet" — two states the card must treat
 * differently, and two states the my-listings slice renders identically as
 * `items: []`. Leaving the load state implicit is what let the spec assert the
 * loading window was a fine place to offer Remove.
 *
 * Default: settled, successful, so every pre-existing case keeps reading as
 * "the count is known".
 */
function stateWith(options: {
  homePoint?: HomePoint | null;
  toyCount?: number;
  listingsLoading?: boolean;
  listingsError?: string | null;
  auth?: Partial<AuthState>;
}) {
  const toyCount = options.toyCount ?? 0;
  return {
    [authFeatureKey]: {
      ...initialAuthState,
      isAuthenticated: true,
      isInitializing: false,
      user: {
        id: 'u1',
        email: 'owner@rental.local',
        firstName: 'Ada',
        lastName: 'Lovelace',
        roles: ['User'],
        homePoint: options.homePoint === undefined ? HOME_POINT : options.homePoint,
      },
      ...(options.auth ?? {}),
    },
    [myListingsFeatureKey]: {
      ...initialMyListingsState,
      items: Array.from({ length: toyCount }, (_, i) => ({ id: `l${i}` })),
      isLoading: options.listingsLoading ?? false,
      error: options.listingsError ?? null,
    },
  };
}

interface Testable {
  openPicker(): void;
  onPickerConfirmed(selection: HomePointSelection): void;
  cancelChange(): void;
  confirmChange(): void;
  openRemoveConfirm(): void;
  confirmRemove(): void;
  changeConfirmOpen(): boolean;
  removeConfirmOpen(): boolean;
  pickerOpen(): boolean;
  canRemove(): boolean;
  toyCount(): number;
  toyCountKnown(): boolean;
}

function setup(options: Parameters<typeof stateWith>[0] = {}): {
  fixture: ComponentFixture<HomePointCardComponent>;
  component: Testable;
  store: Store;
  mockStore: MockStore;
  messages: MessageService;
} {
  TestBed.configureTestingModule({
    imports: [HomePointCardComponent, TranslateModule.forRoot()],
    providers: [provideMockStore({ initialState: stateWith(options) }), MessageService],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    profile: {
      homePoint: {
        toastTitle: 'Home point updated',
        toastBody: '{{count}} toys now show {{district}}',
        toastBodyNone: 'Home point saved',
        removedToast: 'Home point removed',
        // The three "N is not known yet" strings, and the two they must
        // replace: the loading-window tests below assert on which of the pair
        // the card chose, so both halves have to be real text.
        usedByNone: 'Toys you list will use it',
        usedByUnknown: 'Toy count not loaded yet',
        removeBlocked: 'You have toys listed',
        removeUnknown: 'Available once we know how many toys use this point.',
        changeBodyNone: 'You have no toys listed, so nothing else changes.',
        changeBodyUnknown: 'This moves every toy you have listed to the new area.',
        changeConfirm: 'Move home point',
        changeConfirmNone: 'Save home point',
        // Needed by the accessible-name tests at the bottom of this file:
        // these two strings are what `[header]` feeds to the span that
        // `aria-labelledby` points at.
        changeTitle: 'Move your home point?',
        removeTitle: 'Remove your home point?',
        // The refusal copy the card picks by ERROR CODE — see the
        // "refusals are shown as copy" block at the bottom of this file.
        errorInUse: 'You still have toys listed, so the home point cannot be removed.',
        errorGeneric: 'We could not save your home point. Please try again.',
      },
    },
    homePoint: {
      status: {
        outsideTitle: 'For now DoRent works only in Yerevan',
      },
    },
  });
  translate.use('en');

  const fixture = TestBed.createComponent(HomePointCardComponent);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance as unknown as Testable,
    store: TestBed.inject(Store),
    mockStore: TestBed.inject(MockStore),
    messages: TestBed.inject(MessageService),
  };
}

describe('HomePointCardComponent — states', () => {
  it('empty: an invitation with one CTA, not a warning', () => {
    const { fixture } = setup({ homePoint: null });

    expect(fixture.nativeElement.querySelector('.hp-card--empty')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hp-card__cta')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hp-card__remove-btn')).toBeNull();
  });

  it('set: shows the district, the toy count and the privacy line', () => {
    const { fixture } = setup({ toyCount: 4 });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Kentron');
    expect(fixture.nativeElement.querySelector('.hp-card__privacy')).toBeTruthy();
  });

  /**
   * Removing a home point while listings exist would leave them unplaceable;
   * the backend refuses with 409 `auth.home_point_in_use`. The card says so up
   * front instead of letting the owner find out from an error.
   */
  it('set with toys: Remove is disabled and explains why', () => {
    const { fixture, component } = setup({ toyCount: 4 });

    expect(component.canRemove()).toBe(false);
    const button = fixture.nativeElement.querySelector('.hp-card__remove-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.hp-card__remove-note')).toBeTruthy();
  });

  /**
   * CORRECTED. This case used to read `setup({ toyCount: 0 })` and assert
   * "Remove is active and unexplained" — and `toyCount: 0` was, at the time,
   * indistinguishable from the window before `GET /api/listings/mine` answers,
   * because the fixture left `isLoading` at its initial `false`. So the spec
   * asserted that the loading window was a correct place to enable a
   * destructive action the backend refuses with 409 `auth.home_point_in_use`.
   *
   * The permission belongs to a SETTLED, successful load that returned nothing,
   * and the fixture now says so out loud.
   */
  it('set with no toys and the count LOADED: Remove is active and unexplained', () => {
    const { fixture, component } = setup({
      toyCount: 0,
      listingsLoading: false,
      listingsError: null,
    });

    expect(component.toyCountKnown()).toBe(true);
    expect(component.canRemove()).toBe(true);
    const button = fixture.nativeElement.querySelector('.hp-card__remove-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.hp-card__remove-note')).toBeNull();
  });

  it('reads the point from the AUTH store, so there is no second copy to go stale', () => {
    const { fixture, mockStore } = setup({ toyCount: 1 });
    expect(fixture.nativeElement.textContent).toContain('Kentron');

    mockStore.setState(stateWith({ homePoint: { ...HOME_POINT, district: ARABKIR }, toyCount: 1 }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Arabkir');
  });
});

/**
 * The card's N comes from the my-listings slice, whose `items` is `[]` both
 * before `GET /api/listings/mine` answers and when the owner genuinely has no
 * toys — and the profile page dispatches that load as this card mounts, so the
 * ambiguous state is the one every owner sees first.
 *
 * Reading `[]` as a real zero produced two user-visible lies in that window:
 * Remove was enabled and unexplained (and the backend refuses it with 409
 * `auth.home_point_in_use`), and a move captured N = 0, so the confirmation
 * promised "nothing else changes" while the server relocated the owner's whole
 * catalogue. Both are checked here against a real `TestBed.createComponent`
 * (M-028) rather than by reading the computed signals alone.
 */
describe('HomePointCardComponent — N is UNKNOWN until /listings/mine answers', () => {
  it('offers no Remove and claims no count while the load is in flight', () => {
    const { fixture, component } = setup({ toyCount: 0, listingsLoading: true });

    expect(component.toyCountKnown()).toBe(false);
    expect(component.canRemove()).toBe(false);

    const button = fixture.nativeElement.querySelector('.hp-card__remove-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // Disabled WITH a reason — and not the "you have toys listed" reason, which
    // the card cannot know yet either.
    const note = fixture.nativeElement.querySelector('.hp-card__remove-note') as HTMLElement;
    expect(note).toBeTruthy();
    expect(note.textContent).toContain('Available once we know');
    expect(note.textContent).not.toContain('You have toys listed');

    // And the subtitle does not assert a count in either direction.
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Toy count not loaded yet');
    expect(text).not.toContain('Toys you list will use it');
  });

  /** A load that FAILED leaves `isLoading` false with `items` still `[]` — the
   *  same false zero, arriving by a different route. */
  it('treats a failed load as unknown, not as zero', () => {
    const { fixture, component } = setup({
      toyCount: 0,
      listingsLoading: false,
      listingsError: 'Could not load your toys',
    });

    expect(component.toyCountKnown()).toBe(false);
    expect(component.canRemove()).toBe(false);
    const button = fixture.nativeElement.querySelector('.hp-card__remove-btn') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('a move confirmed in that window never promises "nothing else changes"', () => {
    const { fixture, component } = setup({ toyCount: 0, listingsLoading: true });

    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    // The N=0 branch — a plain `.hp-sheet__lead` saying nothing else changes —
    // is what the unknown window used to render. It must not be reachable here.
    expect(document.querySelector('.hp-sheet__lead')).toBeNull();
    const note = document.querySelector('.hp-sheet__note');
    expect(note).toBeTruthy();
    expect(note!.textContent).toContain('every toy you have listed');

    // "Save home point" asserts there is nothing to move; "Move home point" is
    // true whatever N turns out to be.
    const primary = document.querySelector('.hp-sheet__primary') as HTMLElement;
    expect(primary.textContent).toContain('Move home point');
    expect(primary.textContent).not.toContain('Save home point');
  });

  /**
   * Pins a DECISION rather than a regression (the old code reached the same
   * string by accident, via N = 0): the toast agrees with the sheet the owner
   * accepted. That sheet could not name N, so the toast does not either — even
   * though `mine` has since answered with four toys by the time the PUT lands.
   */
  it('the toast for that move names no N rather than naming the wrong one', () => {
    const { fixture, component, mockStore, messages } = setup({
      toyCount: 0,
      listingsLoading: true,
    });
    const add = vi.spyOn(messages, 'add');

    component.onPickerConfirmed(NEW_SELECTION);
    component.confirmChange();

    mockStore.setState(
      stateWith({ toyCount: 0, listingsLoading: true, auth: { homePointSaving: true } }),
    );
    fixture.detectChanges();
    mockStore.setState(
      stateWith({
        homePoint: { ...HOME_POINT, district: ARABKIR },
        toyCount: 4,
        auth: { homePointSaving: false },
      }),
    );
    fixture.detectChanges();

    expect(add).toHaveBeenCalledTimes(1);
    const detail = (add.mock.calls[0][0] as { detail?: string }).detail ?? '';
    expect(detail).toBe('Home point saved');
    expect(detail).not.toContain('0');
  });
});

describe('HomePointCardComponent — change flow', () => {
  it('Change opens the picker, and confirming it opens the "moves N toys" confirmation', () => {
    const { fixture, component } = setup({ toyCount: 4 });

    component.openPicker();
    expect(component.pickerOpen()).toBe(true);

    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    expect(component.pickerOpen()).toBe(false);
    expect(component.changeConfirmOpen()).toBe(true);
    const sheet = document.querySelector('.hp-sheet__body');
    expect(sheet).toBeTruthy();
    // Now → New, both named.
    expect(sheet!.textContent).toContain('Kentron');
    expect(sheet!.textContent).toContain('Arabkir');
  });

  it('the confirmation warns about the N toys that will move', () => {
    const { fixture, component } = setup({ toyCount: 4 });

    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    expect(document.querySelector('.hp-sheet__note')).toBeTruthy();
  });

  it('with no toys the confirmation is one plain line — there is nothing to warn about', () => {
    const { fixture, component } = setup({ toyCount: 0 });

    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    expect(document.querySelector('.hp-sheet__note')).toBeNull();
    expect(document.querySelector('.hp-sheet__lead')).toBeTruthy();
  });

  it('nothing is written until the confirmation is accepted', () => {
    const { component, store } = setup({ toyCount: 4 });
    const dispatch = vi.spyOn(store, 'dispatch');

    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);

    expect(
      dispatch.mock.calls.some(
        (call) =>
          (call[0] as unknown as { type: string }).type === AuthActions.updateHomePoint.type,
      ),
    ).toBe(false);
  });

  it('accepting the confirmation dispatches the PUT with the new coordinates', () => {
    const { component, store } = setup({ toyCount: 4 });
    const dispatch = vi.spyOn(store, 'dispatch');

    component.onPickerConfirmed(NEW_SELECTION);
    component.confirmChange();

    expect(dispatch).toHaveBeenCalledWith(
      AuthActions.updateHomePoint({ payload: { latitude: 40.21, longitude: 44.49 } }),
    );
    expect(component.changeConfirmOpen()).toBe(false);
  });

  it('Cancel drops the new point and keeps the old one', () => {
    const { component, store } = setup({ toyCount: 4 });
    const dispatch = vi.spyOn(store, 'dispatch');

    component.onPickerConfirmed(NEW_SELECTION);
    component.cancelChange();
    // Accepting afterwards must do nothing — the pending point is gone.
    component.confirmChange();

    expect(component.changeConfirmOpen()).toBe(false);
    expect(
      dispatch.mock.calls.some(
        (call) =>
          (call[0] as unknown as { type: string }).type === AuthActions.updateHomePoint.type,
      ),
    ).toBe(false);
  });

  /**
   * The toast reports a COMPLETED move, so it waits for the request rather than
   * firing on the click — and it names the district as a PARAMETER (the boards
   * hardcoded "Arabkir", which is right exactly once).
   */
  it('the success toast fires only after the save lands, naming N and the new district', () => {
    const { fixture, component, mockStore, messages } = setup({ toyCount: 4 });
    const add = vi.spyOn(messages, 'add');

    component.onPickerConfirmed(NEW_SELECTION);
    component.confirmChange();

    mockStore.setState(stateWith({ toyCount: 4, auth: { homePointSaving: true } }));
    fixture.detectChanges();
    expect(add).not.toHaveBeenCalled();

    mockStore.setState(
      stateWith({
        homePoint: { ...HOME_POINT, district: ARABKIR },
        toyCount: 4,
        auth: { homePointSaving: false },
      }),
    );
    fixture.detectChanges();

    expect(add).toHaveBeenCalledTimes(1);
    const detail = (add.mock.calls[0][0] as { detail?: string }).detail ?? '';
    expect(detail).toContain('4');
    expect(detail).toContain('Arabkir');
  });

  it('a failed save shows no toast and surfaces the refusal on the card', () => {
    const { fixture, component, mockStore, messages } = setup({ toyCount: 4 });
    const add = vi.spyOn(messages, 'add');

    component.onPickerConfirmed(NEW_SELECTION);
    component.confirmChange();

    mockStore.setState(stateWith({ toyCount: 4, auth: { homePointSaving: true } }));
    fixture.detectChanges();
    mockStore.setState(
      stateWith({
        toyCount: 4,
        auth: {
          homePointSaving: false,
          homePointError: 'Home point must be inside Yerevan',
          homePointErrorCode: 'auth.home_point_outside_yerevan',
        },
      }),
    );
    fixture.detectChanges();

    expect(add).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.hp-card__error')).toBeTruthy();
  });

  /**
   * Defect 2 of the review: the card used to latch "I have seen
   * `saving() === true`" and then require a LATER `false`, so a response that
   * never produced an observed saving frame left the successful move
   * unannounced. `create-listing-form.component.ts` already had the robust
   * shape — an in-flight flag set before the dispatch, acted on by the first
   * run that sees a settled save — and the card now uses the same one.
   *
   * Simulated with a SINGLE `setState` straight to the settled success state,
   * which is the case two `setState` calls can never show.
   */
  it('reports a completed move even with no observed saving() frame', () => {
    const { fixture, component, mockStore, messages } = setup({ toyCount: 4 });
    const add = vi.spyOn(messages, 'add');

    component.onPickerConfirmed(NEW_SELECTION);
    component.confirmChange();

    mockStore.setState(stateWith({ homePoint: { ...HOME_POINT, district: ARABKIR }, toyCount: 4 }));
    fixture.detectChanges();

    expect(add).toHaveBeenCalledTimes(1);
    const detail = (add.mock.calls[0][0] as { detail?: string }).detail ?? '';
    expect(detail).toContain('4');
    expect(detail).toContain('Arabkir');
  });
});

describe('HomePointCardComponent — remove flow', () => {
  it('refuses to open the destructive confirm while toys exist', () => {
    const { component } = setup({ toyCount: 2 });

    component.openRemoveConfirm();

    expect(component.removeConfirmOpen()).toBe(false);
  });

  it('opens the destructive confirm when there are no toys', () => {
    const { component } = setup({ toyCount: 0 });

    component.openRemoveConfirm();

    expect(component.removeConfirmOpen()).toBe(true);
  });

  it('confirming dispatches the DELETE', () => {
    const { component, store } = setup({ toyCount: 0 });
    const dispatch = vi.spyOn(store, 'dispatch');

    component.openRemoveConfirm();
    component.confirmRemove();

    expect(dispatch).toHaveBeenCalledWith(AuthActions.clearHomePoint());
    expect(component.removeConfirmOpen()).toBe(false);
  });

  /**
   * Defect 1's worst consequence, and the reason the two toasts now share one
   * implementation: Remove used to announce "Home point removed" on the CLICK.
   * Combined with the false `canRemove()` of the load window that produced the
   * complete inversion — the owner was congratulated on a removal the backend
   * had just refused with 409 `auth.home_point_in_use`, and the card showed no
   * failure at all. The change path had waited for the response all along.
   */
  it('shows no toast on the click, and none at all when the server refuses', () => {
    const { fixture, component, mockStore, messages } = setup({ toyCount: 0 });
    const add = vi.spyOn(messages, 'add');

    component.openRemoveConfirm();
    component.confirmRemove();

    // The DELETE is in flight; nothing has been removed yet.
    expect(add).not.toHaveBeenCalled();

    mockStore.setState(stateWith({ toyCount: 0, auth: { homePointSaving: true } }));
    fixture.detectChanges();
    expect(add).not.toHaveBeenCalled();

    mockStore.setState(
      stateWith({
        toyCount: 0,
        auth: {
          homePointSaving: false,
          // What the store actually holds for this refusal when the response
          // carries no ProblemDetails body: Angular's own diagnostic. It must
          // not be what the owner reads — see the "refusals are shown as copy"
          // block at the bottom of this file.
          homePointError:
            'Http failure response for https://localhost:7241/api/auth/me/home-point: 409 Conflict',
          homePointErrorCode: 'auth.home_point_in_use',
        },
      }),
    );
    fixture.detectChanges();

    expect(add).not.toHaveBeenCalled();
    const error = fixture.nativeElement.querySelector('.hp-card__error') as HTMLElement;
    expect(error).toBeTruthy();
    expect(error.textContent).toContain('toys listed');
    expect(error.textContent).not.toContain('Http failure');
  });

  it('announces the removal once the DELETE lands', () => {
    const { fixture, component, mockStore, messages } = setup({ toyCount: 0 });
    const add = vi.spyOn(messages, 'add');

    component.openRemoveConfirm();
    component.confirmRemove();
    expect(add).not.toHaveBeenCalled();

    mockStore.setState(stateWith({ toyCount: 0, auth: { homePointSaving: true } }));
    fixture.detectChanges();
    expect(add).not.toHaveBeenCalled();

    // `clearHomePointSuccess` replaces the whole user, which is what nulls the
    // point — the card reports the removal it can actually see.
    mockStore.setState(
      stateWith({ homePoint: null, toyCount: 0, auth: { homePointSaving: false } }),
    );
    fixture.detectChanges();

    expect(add).toHaveBeenCalledTimes(1);
    expect((add.mock.calls[0][0] as { summary?: string }).summary).toBe('Home point removed');
    // And the card has fallen back to its empty state.
    expect(fixture.nativeElement.querySelector('.hp-card--empty')).toBeTruthy();
  });
});

/**
 * M-029 regression: `[closable]="false"` on both confirmations (needed only to
 * suppress PrimeNG's default header close icon) silently disabled PrimeNG's
 * `closeOnEscape` AND `dismissableMask`, so neither dialog could be dismissed
 * with the keyboard. Probed live before the fix: after Escape the sheet was
 * still on screen, and a backdrop click did nothing either.
 *
 * These dispatch a REAL `keydown` on `window` against a REAL
 * `TestBed.createComponent` (M-028) rather than calling the handler directly —
 * the defect was in event WIRING, and a test that invokes the method would
 * have passed against the broken code.
 */
describe('HomePointCardComponent — Escape dismisses the confirmations (M-029)', () => {
  function pressEscape(): void {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  it('Escape cancels the change confirmation, exactly as its Cancel button does', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();
    expect(component.changeConfirmOpen()).toBe(true);

    pressEscape();
    fixture.detectChanges();

    expect(component.changeConfirmOpen()).toBe(false);
  });

  it('Escape on the change sheet drops the pending point — it declines, it does not save', () => {
    const { component, fixture, store } = setup({ toyCount: 2 });
    const dispatch = vi.spyOn(store, 'dispatch');
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    pressEscape();
    fixture.detectChanges();
    // Accepting afterwards must do nothing — the pending point is gone, same
    // contract the Cancel button has.
    component.confirmChange();

    expect(component.changeConfirmOpen()).toBe(false);
    expect(
      dispatch.mock.calls.some(
        (call) =>
          (call[0] as unknown as { type: string }).type === AuthActions.updateHomePoint.type,
      ),
    ).toBe(false);
  });

  it('Escape cancels the remove confirmation too', () => {
    const { component, fixture } = setup({ toyCount: 0 });
    component.openRemoveConfirm();
    fixture.detectChanges();
    expect(component.removeConfirmOpen()).toBe(true);

    pressEscape();
    fixture.detectChanges();

    expect(component.removeConfirmOpen()).toBe(false);
  });

  it('is inert when neither confirmation is open — Escape while only the picker is up must not touch this card', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    fixture.detectChanges();
    expect(component.pickerOpen()).toBe(true);
    expect(component.changeConfirmOpen()).toBe(false);

    pressEscape();
    fixture.detectChanges();

    // The picker owns its own Escape (it is `closable`, so PrimeNG handles it);
    // this card must not have reacted at all.
    expect(component.changeConfirmOpen()).toBe(false);
    expect(component.removeConfirmOpen()).toBe(false);
  });

  it('ignores other keys', () => {
    const { component, fixture } = setup({ toyCount: 0 });
    component.openRemoveConfirm();
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(component.removeConfirmOpen()).toBe(true);
  });
});

/**
 * Accessible name on both confirmations — the same defect class as the
 * location picker's (F5.1), reached from the opposite direction.
 *
 * There, a header TEMPLATE suppressed the span that carries the id PrimeNG
 * binds `aria-labelledby` to. Here, no `[header]` was bound at all — and
 * `getAriaLabelledBy()` tests `header !== null`, which `undefined` passes, so
 * the id was minted and bound to a span rendering `{{ undefined }}`. Same
 * outcome: `aria-labelledby` resolved to empty, and a screen reader announced
 * a bare "dialog" before a confirmation that relocates every toy the owner has.
 *
 * Probed live before the fix: `{"ariaLabelledBy":"pn_id_4_header",
 * "labelFound":true,"name":""}`.
 *
 * These read the real portalled DOM from a real `TestBed.createComponent`
 * (M-028) and resolve `aria-labelledby` the way an AT does. A test asserting
 * that `.hp-sheet__title` has text would have passed against the broken code —
 * that <h2> was always there; it just was not what named the dialog.
 */
describe('HomePointCardComponent — the confirmations have an accessible name', () => {
  /** Resolves a dialog's `aria-labelledby` exactly as an AT would. */
  function accessibleNameOf(selector: string): string {
    const dialog = document.body.querySelector<HTMLElement>(selector);
    expect(dialog).toBeTruthy();
    const id = dialog?.getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    const labelEl = document.getElementById(id as string);
    expect(labelEl).toBeTruthy();
    return (labelEl?.textContent ?? '').trim();
  }

  it('the change sheet is named by its own title, not by an empty span', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    const name = accessibleNameOf('.hp-sheet[role="dialog"], .hp-sheet');
    expect(name).not.toBe('');
    expect(name).toBe('Move your home point?');
  });

  it('the remove dialog is named by its own title', () => {
    const { component, fixture } = setup({ toyCount: 0 });
    component.openRemoveConfirm();
    fixture.detectChanges();

    const name = accessibleNameOf('.hp-remove-dialog[role="dialog"], .hp-remove-dialog');
    expect(name).not.toBe('');
    expect(name).toBe('Remove your home point?');
  });

  /**
   * The name element must stay RENDERED. `display: none` on PrimeNG's header
   * would hand the name to the accessible-name algorithm's narrow "directly
   * referenced hidden node" carve-out instead of to a plainly exposed node —
   * so the stylesheet hides it out of flow rather than removing it from the
   * box tree, and that is worth pinning.
   */
  it('keeps the name element in the box tree rather than display:none', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    const dialog = document.body.querySelector<HTMLElement>('.hp-sheet');
    const id = dialog?.getAttribute('aria-labelledby') as string;
    const labelEl = document.getElementById(id) as HTMLElement;
    const header = labelEl.closest('.p-dialog-header') as HTMLElement;

    expect(header).toBeTruthy();
    expect(getComputedStyle(header).display).not.toBe('none');
  });
});

/**
 * F1 regression — the SECOND half of M-029, which the Escape block above never
 * covered. `[closable]="false"` gates PrimeNG's Escape handling
 * (`bindGlobalListeners()`) AND its mask-click handling: `enableModality()`
 * binds its listener only `if (this.closable && this.dismissableMask)`. The
 * earlier fix supplied Escape and claimed the backdrop with it; only Escape was
 * ever tested, so a backdrop click went on doing nothing through 1601 green
 * unit tests and 99 green e2e specs. Reproduced live at 1440x900 on both
 * dialogs before this fix: a mask click at (8,8) left the sheet fully on screen.
 *
 * These dispatch a REAL `mousedown` at the REAL portalled mask element — the
 * same node and the same event PrimeNG's own reference implementation listens
 * for — rather than calling a handler, because the defect was event WIRING.
 */
describe('HomePointCardComponent — a backdrop click dismisses the confirmations (M-029, second half)', () => {
  /** The portalled mask belonging to the dialog whose body matches `bodySelector`. */
  function maskOf(bodySelector: string): HTMLElement {
    const masks = Array.from(document.body.querySelectorAll<HTMLElement>('.p-dialog-mask'));
    const mask = masks.find((candidate) => candidate.querySelector(bodySelector) !== null);
    expect(mask).toBeTruthy();
    return mask as HTMLElement;
  }

  function clickMask(mask: HTMLElement): void {
    mask.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }

  it('a mask click cancels the change confirmation, exactly as its Cancel button does', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();
    expect(component.changeConfirmOpen()).toBe(true);

    clickMask(maskOf('.hp-sheet__body'));
    fixture.detectChanges();

    expect(component.changeConfirmOpen()).toBe(false);
  });

  it('a mask click on the change sheet drops the pending point — it declines, it does not save', () => {
    const { component, fixture, store } = setup({ toyCount: 2 });
    const dispatch = vi.spyOn(store, 'dispatch');
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    clickMask(maskOf('.hp-sheet__body'));
    fixture.detectChanges();
    // Same contract Cancel and Escape have: accepting afterwards must do
    // nothing, because the pending point is gone.
    component.confirmChange();

    expect(component.changeConfirmOpen()).toBe(false);
    expect(
      dispatch.mock.calls.some(
        (call) =>
          (call[0] as unknown as { type: string }).type === AuthActions.updateHomePoint.type,
      ),
    ).toBe(false);
  });

  it('a mask click cancels the remove confirmation too', () => {
    const { component, fixture } = setup({ toyCount: 0 });
    component.openRemoveConfirm();
    fixture.detectChanges();
    expect(component.removeConfirmOpen()).toBe(true);

    clickMask(maskOf('.hp-remove__body'));
    fixture.detectChanges();

    expect(component.removeConfirmOpen()).toBe(false);
  });

  /**
   * A mousedown that STARTS inside the sheet must not dismiss it — otherwise
   * selecting the sheet's text, or pressing a button whose mouseup lands
   * elsewhere, would decline the confirmation. PrimeNG's own reference
   * implementation tests `isSameNode(event.target)` for exactly this reason,
   * and so must ours: a subtree check would close on every click in the body.
   */
  it('a mousedown inside the sheet body does not dismiss it', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    component.onPickerConfirmed(NEW_SELECTION);
    fixture.detectChanges();

    const body = document.body.querySelector<HTMLElement>('.hp-sheet__body');
    expect(body).toBeTruthy();
    body?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(component.changeConfirmOpen()).toBe(true);
  });

  /**
   * The picker is `closable` and owns its own mask dismissal; a mousedown
   * anywhere while neither confirmation is open must leave this card alone.
   */
  it('is inert while neither confirmation is open', () => {
    const { component, fixture } = setup({ toyCount: 2 });
    component.openPicker();
    fixture.detectChanges();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    fixture.detectChanges();

    expect(component.changeConfirmOpen()).toBe(false);
    expect(component.removeConfirmOpen()).toBe(false);
    expect(component.pickerOpen()).toBe(true);
  });
});

/**
 * F2 regression — the card printed `HttpErrorResponse.message` verbatim,
 * including the API URL: "Http failure response for
 * https://localhost:7241/api/auth/me/home-point: 409 Conflict". That string is
 * Angular's internal diagnostic, not copy: it is English-only, it names the
 * backend host, and it tells the owner nothing about what to do. The one code
 * that WAS handled (`auth.home_point_outside_yerevan`) proved the mechanism
 * worked; `auth.home_point_in_use` simply had no copy on this path, and neither
 * did anything else.
 *
 * `homePointError` is kept realistic in each case — the point is that whatever
 * the store's raw string says, the card renders translated copy chosen by the
 * CODE.
 */
describe('HomePointCardComponent — refusals are shown as copy, never as a raw error string', () => {
  const RAW =
    'Http failure response for https://localhost:7241/api/auth/me/home-point: 409 Conflict';

  function errorTextFor(options: Parameters<typeof stateWith>[0]): string {
    const { fixture } = setup(options);
    const el = fixture.nativeElement.querySelector('.hp-card__error') as HTMLElement | null;
    expect(el).toBeTruthy();
    return (el?.textContent ?? '').trim();
  }

  it('auth.home_point_in_use renders the "you still have toys listed" copy', () => {
    const text = errorTextFor({
      toyCount: 0,
      auth: {
        homePointSaving: false,
        homePointError: RAW,
        homePointErrorCode: 'auth.home_point_in_use',
      },
    });

    expect(text).toContain('toys listed');
    expect(text).not.toContain('Http failure');
    expect(text).not.toContain('localhost:7241');
  });

  it('auth.home_point_outside_yerevan keeps its own copy', () => {
    const text = errorTextFor({
      toyCount: 2,
      auth: {
        homePointSaving: false,
        homePointError: 'Home point must be inside Yerevan',
        homePointErrorCode: 'auth.home_point_outside_yerevan',
      },
    });

    expect(text).toContain('Yerevan');
  });

  /**
   * The codes above are not the only refusals these two endpoints can produce:
   * PUT/DELETE /api/auth/me/home-point are rate-limited (429, with no
   * ProblemDetails body at all), can answer 401/403, and a dropped connection
   * surfaces as status 0. Every one of those arrives with `errorCode: null` and
   * used to fall straight through to the raw string.
   */
  it('an unmapped refusal falls back to generic copy, not to the raw message', () => {
    const text = errorTextFor({
      toyCount: 2,
      auth: {
        homePointSaving: false,
        homePointError:
          'Http failure response for https://localhost:7241/api/auth/me/home-point: 429 Too Many Requests',
        homePointErrorCode: null,
      },
    });

    expect(text).not.toContain('Http failure');
    expect(text).not.toContain('localhost:7241');
    expect(text).not.toBe('');
  });

  /**
   * A server-supplied ProblemDetails `title` is English-only server copy — the
   * real backend sends one on every mapped refusal — so it must not reach the
   * card either, in any language.
   */
  it('a server-supplied title does not reach the card', () => {
    const text = errorTextFor({
      toyCount: 2,
      auth: {
        homePointSaving: false,
        homePointError: 'Home point is already in use by your listings.',
        homePointErrorCode: 'auth.home_point_in_use',
      },
    });

    expect(text).not.toContain('already in use by your listings');
  });
});
