import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { InputNumber } from 'primeng/inputnumber';

import * as AuthActions from '../../../auth/store/auth.actions';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import { CreateListingFormComponent } from './create-listing-form.component';
import type {
  ListingFormMode,
  ListingImageOrderItem,
} from './create-listing-form.component';
import { LocationPickerComponent } from '../../../../shared/ui/location-picker/location-picker.component';
import type { CreateListingRequest } from '../../models/create-listing.model';
import type { ListingDistrict } from '../../models/district.model';
import type { HomePointSelection } from '../../../../shared/ui/home-point-map/home-point-map.model';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';
import {
  HOME_POINT_DERIVED_FIELDS,
  homePointDerivedFieldsIn,
} from '../../../../../testing/listing-write-contract';

/**
 * The focus-return regression tests below advance the wizard to Step 3, which
 * renders `<app-map>` for the confirmed-pin preview (see `hasPin()` branch in
 * the template) — a real `import('leaflet')` in `ngAfterViewInit`. Stubbed the
 * same way `location-picker.component.spec.ts` does, since these tests only
 * care about focus/DOM wiring, not Leaflet's own rendering.
 */
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
  divIcon: vi.fn((options: unknown) => options),
}));

/**
 * Regression net for the create-listing wizard's Step-3 payload (confirmed
 * data-loss bug, fixed 2026-07-17; delivery upgraded from single-select to a
 * multi-select `deliveryTypes` array afterwards).
 *
 * The wizard collects a minimum rental period and one or more delivery
 * methods. These tests pin the contract that matters — the emitted
 * `submitted` payload MUST carry:
 *   - `minRentalDays` as the chosen day-count NUMBER,
 *   - `deliveryTypes` as an array of the STRING union 'Pickup' | 'Courier',
 *     ordered [Pickup, Courier] regardless of toggle order, and
 *   - `deliveryType` as a legacy scalar mirror (`Pickup` whenever Pickup is
 *     among the selected types, `Courier` otherwise) — the API's
 *     JsonStringEnumConverter still expects the old field name too, and older
 *     backend/UI code paths read it.
 *
 * This is the cheapest reliable layer for a payload-construction bug: it targets
 * `onSubmit()` directly, needs no browser/DB, and would have gone red the moment
 * the fields were dropped.
 */

type SubmitEvent = {
  payload: CreateListingRequest;
  files: File[];
  imageOrder: ListingImageOrderItem[] | null;
};

/** Access the protected submit handler without loosening component visibility. */
interface Submittable {
  onSubmit(): void;
  canSubmit(): boolean;
}

/**
 * The wizard reads the owner's home point from the auth store (home-point
 * model): with none set it renders its GATE instead of the steps, so every test
 * below that touches a step has to start from an owner who has one. Tests for
 * the gate itself override this with `homePoint: null`.
 */
const HOME_POINT = {
  latitude: 40.1834,
  longitude: 44.515,
  publicLatitude: 40.1835,
  publicLongitude: 44.5152,
  district: {
    id: 'd1111111-1111-1111-1111-111111111111',
    code: 'kentron',
    nameEn: 'Kentron',
    nameHy: 'Կենտրոն',
    nameRu: 'Кентрон',
  },
  updatedAt: '2026-09-27T20:03:21.000Z',
};

function authStateWith(homePoint: typeof HOME_POINT | null) {
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
        homePoint,
      },
    },
  };
}

function createComponent(
  mode: ListingFormMode = 'create',
  homePoint: typeof HOME_POINT | null = HOME_POINT,
) {
  TestBed.configureTestingModule({
    imports: [CreateListingFormComponent, TranslateModule.forRoot()],
    // `provideRouter([])` is required for step 5's `routerLink="/terms"` (the
    // community-rules link) — only exercised by tests that actually render
    // step 5, but harmless to provide unconditionally for every test here.
    providers: [
      provideMockStore({ initialState: authStateWith(homePoint) }),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(CreateListingFormComponent);
  const component = fixture.componentInstance;
  // Set the mode BEFORE the first change detection so `ngOnInit` runs with it
  // (edit mode drops the category validator there).
  component.mode = mode;
  fixture.detectChanges();
  return { fixture, component };
}

/** Fills every control the submit guard requires so `onSubmit()` proceeds. */
function fillValidBasics(component: CreateListingFormComponent): void {
  component.createListingForm.patchValue({
    title: 'Wooden Train Set',
    description: 'A lovely wooden train set in great condition for toddlers.',
    categoryId: 'cat-123',
    pricePerDay: 9,
    // Loss & damage compensation is required (1,000–10,000,000 ֏) — see the
    // dedicated describe block below for the field's own validation tests.
    compensationAmount: 10000,
  });
}

/** Create mode gates submit on >= 3 photo previews; seed them directly. */
function seedThreePhotos(component: CreateListingFormComponent): void {
  component.selectedFiles = [
    new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
    new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    new File(['c'], 'c.jpg', { type: 'image/jpeg' }),
  ];
  component.imagePreviews.set(['data:a', 'data:b', 'data:c']);
}

/** Subscribes and calls the protected submit handler, returning the emission. */
function submitAndCapture(component: CreateListingFormComponent): SubmitEvent | null {
  let captured: SubmitEvent | null = null;
  const sub = component.submitted.subscribe((e) => (captured = e));
  (component as unknown as Submittable).onSubmit();
  sub.unsubscribe();
  return captured;
}

describe('CreateListingFormComponent — Step-3 payload (min rental + delivery)', () => {
  it('includes the chosen minRentalDays and deliveryTypes (+ legacy mirror) in the create payload', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    // Owner picks a 7-day minimum and switches from the Pickup default to
    // courier-only delivery on Step 3.
    component.selectMinDays(7);
    component.toggleDelivery('Courier');
    component.toggleDelivery('Pickup');

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    const payload = event!.payload;

    expect(payload.minRentalDays).toBe(7);
    expect(payload.deliveryTypes).toEqual(['Courier']);
    expect(payload.deliveryType).toBe('Courier');

    // Type discipline — deliveryTypes is an array of the STRING union, never a
    // number or Set; deliveryType stays a plain string mirror.
    expect(typeof payload.minRentalDays).toBe('number');
    expect(Array.isArray(payload.deliveryTypes)).toBe(true);
    expect(typeof payload.deliveryType).toBe('string');
    expect((payload.deliveryTypes as unknown) instanceof Set).toBe(false);
  });

  it('carries the wizard defaults (1 day / Pickup only) when the owner leaves Step 3 untouched', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    // No selectMinDays / toggleDelivery calls: defaults must still be
    // emitted, not dropped.
    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.minRentalDays).toBe(1);
    expect(event!.payload.deliveryTypes).toEqual(['Pickup']);
    expect(event!.payload.deliveryType).toBe('Pickup');
  });

  it('selecting both delivery types sends them ordered [Pickup, Courier] with deliveryType mirroring Pickup', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    // Toggle Courier on top of the Pickup default — both now active.
    component.toggleDelivery('Courier');

    expect(component.isDeliverySelected('Pickup')).toBe(true);
    expect(component.isDeliverySelected('Courier')).toBe(true);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    // Ordered [Pickup, Courier] regardless of toggle order.
    expect(event!.payload.deliveryTypes).toEqual(['Pickup', 'Courier']);
    expect(event!.payload.deliveryType).toBe('Pickup');
  });

  it('never removes the last remaining delivery type', () => {
    const { component } = createComponent('create');

    expect(component.isDeliverySelected('Pickup')).toBe(true);
    expect(component.isDeliverySelected('Courier')).toBe(false);

    // Only Pickup is selected — toggling it off must be a no-op.
    component.toggleDelivery('Pickup');

    expect(component.isDeliverySelected('Pickup')).toBe(true);
    expect(component.createListingForm.controls.deliveryTypes.value).toEqual(['Pickup']);
  });

  it('a 365-day minimum rental reaches the payload', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    component.selectMinDays(365);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.minRentalDays).toBe(365);
  });

  it('round-trips both fields back out in edit mode from a prefilled listing', () => {
    const { component } = createComponent('edit');
    // Edit mode gates submit on the gallery keeping >= 1 photo.
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    component.prefill = {
      title: 'Wooden Train Set',
      description: 'A lovely wooden train set in great condition for toddlers.',
      categoryId: 'cat-123',
      pricePerDay: 9,
      priceUnit: 'Daily',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: null,
      safetyNotes: null,
      compensationAmount: 10000,
      minRentalDays: 14,
      deliveryTypes: ['Pickup', 'Courier'],
    };

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.minRentalDays).toBe(14);
    expect(event!.payload.deliveryTypes).toEqual(['Pickup', 'Courier']);
    expect(event!.payload.deliveryType).toBe('Pickup');
    // Edit mode emits an image order; sanity-check the field survived alongside it.
    expect(event!.imageOrder).not.toBeNull();
  });

  it('prefills deliveryTypes from the legacy scalar deliveryType when deliveryTypes is absent', () => {
    const { component } = createComponent('edit');
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    component.prefill = {
      title: 'Older Listing',
      description: 'A listing saved back when delivery was still a single choice.',
      categoryId: 'cat-123',
      pricePerDay: 8,
      priceUnit: 'Daily',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: null,
      safetyNotes: null,
      compensationAmount: 10000,
      minRentalDays: 3,
      deliveryType: 'Courier',
      // deliveryTypes intentionally omitted — the legacy shape.
    };

    expect(component.createListingForm.controls.deliveryTypes.value).toEqual(['Courier']);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.deliveryTypes).toEqual(['Courier']);
    expect(event!.payload.deliveryType).toBe('Courier');
  });

  it('falls back to 1 day / Pickup when editing a legacy listing that predates the fields', () => {
    const { component } = createComponent('edit');
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    // Listings created before these columns existed come back with null.
    component.prefill = {
      title: 'Legacy Listing',
      description: 'An older listing created before min-rental and delivery existed.',
      categoryId: 'cat-123',
      pricePerDay: 5,
      priceUnit: 'Daily',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: null,
      hygieneNotes: null,
      safetyNotes: null,
      // Required for submit to proceed at all; this test is about the
      // minRentalDays/deliveryType fallback defaults, not this field.
      compensationAmount: 10000,
      minRentalDays: null,
      deliveryType: null,
    };

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    // Must not emit null (which would re-introduce a different data-loss shape).
    expect(event!.payload.minRentalDays).toBe(1);
    expect(event!.payload.deliveryTypes).toEqual(['Pickup']);
    expect(event!.payload.deliveryType).toBe('Pickup');
  });
});

describe('CreateListingFormComponent — Step 3 pickup area (no address line)', () => {
  function goToStep3(fixture: ReturnType<typeof createComponent>['fixture'], component: CreateListingFormComponent) {
    component.currentStep.set(3);
    fixture.detectChanges();
  }

  it('renders no address-line input', () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    expect(fixture.nativeElement.querySelector('[formcontrolname="addressLine"]')).toBeNull();
    expect((component.createListingForm.controls as Record<string, unknown>)['addressLine']).toBeUndefined();
  });

  it('always sends addressLine: null in the payload', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.addressLine).toBeNull();
  });

  /**
   * The edit page reuses this component with `mode: 'edit'`. It gets the same
   * read-only card — a listing cannot have a location of its own any more — and
   * the card must never be able to block Save: it carries no form control, no
   * validation and no required state (M-038).
   */
  it('edit mode renders the same read-only card and never gates Save on it', () => {
    const { fixture, component } = createComponent('edit');
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    goToStep3(fixture, component);

    expect(fixture.nativeElement.querySelector('app-pickup-area-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[formcontrolname="city"]')).toBeNull();
    expect((component as unknown as Submittable).canSubmit()).toBe(true);
  });

  it('edit mode keeps Save enabled even with NO home point at all', () => {
    const { fixture, component } = createComponent('edit', null);
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    goToStep3(fixture, component);

    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeNull();
    expect((component as unknown as Submittable).canSubmit()).toBe(true);
  });

  it('the Pickup-area card is read-only and its "Change home point" row opens the picker in place', () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    // Read-only: no city input, no district select, no per-listing pin CTA.
    expect(fixture.nativeElement.querySelector('[formcontrolname="city"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('#wz-district')).toBeNull();
    expect(fixture.nativeElement.querySelector('.location-card__cta')).toBeNull();

    expect(component.showLocationPicker()).toBe(false);
    const trigger = fixture.nativeElement.querySelector(
      '.pickup-card__change',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    trigger.click();
    fixture.detectChanges();

    // Opens IN PLACE — it must not navigate away, or the half-filled wizard
    // (which saves no draft) would be lost.
    expect(component.showLocationPicker()).toBe(true);
  });
});

/**
 * HOME-POINT MODEL: a listing has no coordinates of its own any more.
 * `latitude`, `longitude`, `districtId`, `city` and `country` were removed from
 * `CreateListingRequest`; the backend derives all five from the owner's home
 * point. The wizard therefore holds no such controls, and the picker it opens
 * writes the HOME POINT (a `PUT /api/auth/me/home-point` dispatch), not a
 * per-listing pin.
 *
 * Both halves are pinned here: the payload must not carry the five fields (a
 * stale client that re-added them would be silently ignored by the server, i.e.
 * accepted-looking and never applied), and confirming the picker must dispatch
 * the home-point update.
 */
interface LocationWireable {
  onLocationConfirmed(coord: MapLatLng): void;
  showLocationPicker: { set(v: boolean): void };
}

describe('CreateListingFormComponent — home point → payload', () => {
  it('holds no latitude/longitude/districtId/city controls at all', () => {
    const { component } = createComponent('create');
    const controls = component.createListingForm.controls as Record<string, unknown>;

    for (const field of HOME_POINT_DERIVED_FIELDS) {
      expect(controls[field]).toBeUndefined();
    }
  });

  it('omits the home-point-derived fields from the create payload', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    // Key-set check over the shared constant (src/testing/listing-write-contract.ts),
    // not five hand-written assertions — a sixth derived field added there is
    // covered here by construction. The same helper guards the update path
    // (edit-listing-page.component.spec.ts) and both wire-level e2e specs.
    expect(homePointDerivedFieldsIn(event!.payload)).toEqual([]);
  });

  it('confirming the picker dispatches a home-point update, not a form patch', () => {
    const { component } = createComponent('create');
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');

    (component as unknown as LocationWireable).onLocationConfirmed({ lat: 40.19, lng: 44.51 });

    expect(dispatch).toHaveBeenCalledWith(
      AuthActions.updateHomePoint({ payload: { latitude: 40.19, longitude: 44.51 } }),
    );
  });
});

/**
 * The gate before step 1. Without a home point the backend refuses to create a
 * listing (409 `listing.home_point_required`), so the wizard asks for one first
 * rather than letting the owner fill five steps and fail at the end.
 */
describe('CreateListingFormComponent — home-point gate', () => {
  it('renders the gate instead of the wizard steps when the owner has no home point', () => {
    const { fixture } = createComponent('create', null);

    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.wizard--hidden')).toBeTruthy();
  });

  it('renders the wizard, not the gate, once a home point exists', () => {
    const { fixture } = createComponent('create');

    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeNull();
    expect(fixture.nativeElement.querySelector('.wizard--hidden')).toBeNull();
  });

  it('never gates edit mode — an existing listing is already placed (M-038)', () => {
    const { fixture } = createComponent('edit', null);

    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeNull();
  });

  it('re-raises the gate when the server refused a create with listing.home_point_required', () => {
    const { fixture, component } = createComponent('create');
    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeNull();

    fixture.componentRef.setInput('homePointRequiredByServer', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.wizard--gate')).toBeTruthy();
  });

  it("the gate's primary button starts disabled — nobody saves the city centre by accident", () => {
    const { fixture } = createComponent('create', null);

    const cta = fixture.nativeElement.querySelector(
      '.wizard__footer-inner--gate .wizard__btn--primary',
    ) as HTMLButtonElement;
    expect(cta).toBeTruthy();
    expect(cta.disabled).toBe(true);
  });

  it('enables the primary button once the map reports a deliberate, valid point, and saving dispatches the update', () => {
    const { fixture, component } = createComponent('create', null);
    const store = TestBed.inject(MockStore);
    const dispatch = vi.spyOn(store, 'dispatch');

    (
      component as unknown as { onGateSelectionChange(s: HomePointSelection): void }
    ).onGateSelectionChange({
      center: { lat: 40.19, lng: 44.51 },
      district: HOME_POINT.district,
      resolving: false,
      outsideYerevan: false,
      deliberate: true,
      geoState: 'idle',
      lowAccuracyMeters: null,
      canConfirm: true,
    });
    fixture.detectChanges();

    const cta = fixture.nativeElement.querySelector(
      '.wizard__footer-inner--gate .wizard__btn--primary',
    ) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);

    cta.click();

    expect(dispatch).toHaveBeenCalledWith(
      AuthActions.updateHomePoint({ payload: { latitude: 40.19, longitude: 44.51 } }),
    );
  });
});

/**
 * a11y regression (verifier-confirmed, P1-6): closing the location picker via
 * Confirm left `document.activeElement` on `<body>` forever. The fix moves
 * the focus call into an `afterRenderEffect` (the same post-render primitive
 * `conversation-details-page.component.ts` uses to scroll after new messages
 * render), gated by a `focusReturnPending` flag set right before the picker
 * closes — see `openLocationPicker`/`closeLocationPicker` in the component.
 *
 * The step-3 redesign (pricing/location layout rework) collapsed the CTA and
 * the post-confirm "Change" affordance into a SINGLE persistent
 * `.pickup-card__change` button whose text swaps on `hasPin()` instead of an
 * `@if/@else` pair of different buttons — so there is no DOM node swap to
 * race any more, but the trigger still needs focus explicitly returned to it
 * once the full-screen picker dialog closes (opening it moves focus away).
 * These tests render the real Step-3 DOM (not the direct-method-call style
 * used by the P1-6 payload tests above) so they exercise the actual template
 * and query `document.activeElement` the same way the verifier's manual
 * repro did.
 */
describe('CreateListingFormComponent — location picker focus return (a11y)', () => {
  function goToStep3(fixture: ReturnType<typeof createComponent>['fixture'], component: CreateListingFormComponent) {
    component.currentStep.set(3);
    fixture.detectChanges();
  }

  it('Confirm: focus returns to the trigger button once the post-render effect has run (regression)', async () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    const trigger = fixture.nativeElement.querySelector('.pickup-card__change') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    (component as unknown as LocationWireable).onLocationConfirmed({ lat: 40.1776, lng: 44.5126 });
    // Let a microtask-scheduled callback registered synchronously during the
    // call above (the old buggy fix used `queueMicrotask`) run BEFORE Angular
    // re-renders — reproducing the actual race the verifier hit, rather than
    // masking it by rendering first.
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();

    // Same node throughout — the button's text switches to "Change" but it
    // never gets destroyed/recreated, unlike the old @if/@else pair.
    const sameTrigger = fixture.nativeElement.querySelector('.pickup-card__change') as HTMLButtonElement;
    expect(sameTrigger).toBe(trigger);
    expect(document.activeElement).toBe(sameTrigger);
  });

  it('Cancel: focus returns to the CTA button (same node persists — no template swap)', async () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    const cta = fixture.nativeElement.querySelector('.pickup-card__change') as HTMLButtonElement;
    cta.focus();
    expect(document.activeElement).toBe(cta);

    (component as unknown as { onLocationCancelled(): void }).onLocationCancelled();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.pickup-card__change'));
  });

  it('Escape: the picker maps it to the same cancel path (PrimeNG dialog visibleChange(false)), which returns focus to the CTA button', async () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    const cta = fixture.nativeElement.querySelector('.pickup-card__change') as HTMLButtonElement;
    cta.focus();
    expect(document.activeElement).toBe(cta);

    // Drive the REAL child component's Escape-equivalent handler (verified in
    // `location-picker.component.spec.ts` to be what Escape/the header close
    // button trigger) so this exercises the actual `(cancelled)` output
    // binding between the two components, not just the parent's own handler.
    const picker = fixture.debugElement.query(By.directive(LocationPickerComponent))
      .componentInstance as unknown as { onVisibleChange(visible: boolean): void };
    picker.onVisibleChange(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.pickup-card__change'));
  });
});

/**
 * The price input's `suffix` used to be the hardcoded literal `' ֏'` (a
 * plain space, not the NBSP `DramCurrencyPipe`/`DRAM_SYMBOL` convention uses
 * elsewhere) — the only place in the UI duplicating the glyph instead of
 * importing `DRAM_SYMBOL`. Now bound to `[suffix]="dramSuffix"`, built from
 * `DRAM_SYMBOL` with a `\u00A0` prefix, matching the sibling compensation
 * input's `{{ dramSymbol }}` suffix span.
 */
describe('CreateListingFormComponent — price input dram suffix', () => {
  function goToStep3(
    fixture: ReturnType<typeof createComponent>['fixture'],
    component: CreateListingFormComponent,
  ) {
    component.currentStep.set(3);
    fixture.detectChanges();
  }

  it('renders the price p-inputNumber with an NBSP-joined dram suffix, not a plain-space literal', () => {
    const { fixture, component } = createComponent('create');
    goToStep3(fixture, component);

    const instance = fixture.debugElement
      .queryAll(By.directive(InputNumber))
      .map((debugEl) => debugEl.componentInstance as InputNumber)
      .find((c) => c.inputId === 'wz-price');

    expect(instance).toBeTruthy();
    expect(instance!.suffix).toBe('\u00A0֏');
    expect(instance!.suffix).not.toBe(' ֏');
  });
});

/**
 * Loss & damage compensation (step 3): required, whole AMD, 1,000–10,000,000.
 * Redefines the old optional `depositAmount` — the renter's maximum liability
 * if the toy is lost, seriously damaged or not returned. Nothing is paid
 * upfront and DoRent never collects/holds/refunds it (ADR-014).
 */
describe('CreateListingFormComponent — loss & damage compensation (step 3)', () => {
  function fillBasicsExceptCompensation(component: CreateListingFormComponent): void {
    component.createListingForm.patchValue({
      title: 'Wooden Train Set',
      description: 'A lovely wooden train set in great condition for toddlers.',
      categoryId: 'cat-123',
      pricePerDay: 9,
    });
  }

  it('blocks submit when the amount is empty (required)', () => {
    const { component } = createComponent('create');
    fillBasicsExceptCompensation(component);
    seedThreePhotos(component);

    const event = submitAndCapture(component);

    expect(event).toBeNull();
    expect(component.createListingForm.controls.compensationAmount.hasError('required')).toBe(
      true,
    );
  });

  it('blocks submit when the amount is below the 1,000 ֏ minimum', () => {
    const { component } = createComponent('create');
    fillBasicsExceptCompensation(component);
    seedThreePhotos(component);
    component.createListingForm.patchValue({ compensationAmount: 500 });

    const event = submitAndCapture(component);

    expect(event).toBeNull();
    expect(component.createListingForm.controls.compensationAmount.hasError('min')).toBe(true);
  });

  it('blocks submit when the amount is above the 10,000,000 ֏ maximum', () => {
    const { component } = createComponent('create');
    fillBasicsExceptCompensation(component);
    seedThreePhotos(component);
    component.createListingForm.patchValue({ compensationAmount: 10_000_001 });

    const event = submitAndCapture(component);

    expect(event).toBeNull();
    expect(component.createListingForm.controls.compensationAmount.hasError('max')).toBe(true);
  });

  it('includes a valid amount in the submitted payload', () => {
    const { component } = createComponent('create');
    fillBasicsExceptCompensation(component);
    seedThreePhotos(component);
    component.createListingForm.patchValue({ compensationAmount: 45000 });

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.compensationAmount).toBe(45000);
  });

  it('starts the field empty in edit mode when the listing predates this field (null)', () => {
    const { component } = createComponent('edit');
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    component.prefill = {
      title: 'Legacy Listing',
      description: 'An older listing created before this field existed.',
      categoryId: 'cat-123',
      pricePerDay: 5,
      priceUnit: 'Daily',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: null,
      hygieneNotes: null,
      safetyNotes: null,
      compensationAmount: null,
    };

    expect(component.createListingForm.controls.compensationAmount.value).toBeNull();

    // Save stays enabled — the requirement is enforced on submit, not by
    // disabling the button (an owner must not be trapped).
    const event = submitAndCapture(component);
    expect(event).toBeNull();
    expect(component.createListingForm.controls.compensationAmount.hasError('required')).toBe(
      true,
    );
  });

  /**
   * Regression for a bug found in verification: edit mode's Save button was
   * bound to the same `[disabled]="!canSubmit()"` as create mode, so a
   * pre-existing listing with a null compensation amount — reachable at step
   * 5 directly via the desktop stepper rail's `jumpToStep`, which skips the
   * per-step `goToNextStep` validation — showed a greyed-out, inert Save
   * button. The owner had only the top-of-page amber banner as a clue, and a
   * click did nothing. Fixed: edit-mode Save is never disabled; clicking it
   * with an invalid field runs `markAllAsTouched()`, does not submit, and
   * jumps back to the step owning the first invalid control (compensation
   * lives on step 3) with the field focused so the "Required" error is
   * actually visible.
   */
  it('edit mode: Save stays enabled with a null amount, and clicking it does not submit — it jumps to step 3 and surfaces "Required"', () => {
    const { fixture, component } = createComponent('edit');
    component.existingImageUrls = [{ id: 'img-1', url: 'https://x/img-1.jpg' } as never];
    component.prefill = {
      title: 'Legacy Listing',
      description: 'An older listing created before this field existed.',
      categoryId: 'cat-123',
      pricePerDay: 5,
      priceUnit: 'Daily',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: null,
      hygieneNotes: null,
      safetyNotes: null,
      compensationAmount: null,
    };
    // Reached directly via the stepper rail, same as in real use — not by
    // Continue-ing through steps 1–4 (which would have already surfaced the
    // error at step 3).
    component.currentStep.set(5);
    fixture.detectChanges();

    expect((component as unknown as Submittable).canSubmit()).toBe(true);
    const submitBtn = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(false);

    let submitted = false;
    const sub = component.submitted.subscribe(() => {
      submitted = true;
    });
    submitBtn.click();
    sub.unsubscribe();

    expect(submitted).toBe(false);
    expect(component.currentStep()).toBe(3);

    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.comp-card .wizard-field__error');
    expect(errorEl).toBeTruthy();
    expect(component.createListingForm.controls.compensationAmount.hasError('required')).toBe(
      true,
    );
  });
});

/**
 * Regression for a second bug found in the same verification pass: the
 * `p-inputNumber` for `compensationAmount` was bound with `[min]`/`[max]`,
 * which makes PrimeNG silently CLAMP the value on blur (20000000 → 10,000,000)
 * instead of leaving it as typed — so the "Enter an amount between 1,000 ֏
 * and 10,000,000 ֏" error was unreachable and Continue just succeeded. Fixed
 * by dropping the `[min]`/`[max]` bindings and relying solely on the
 * `Validators.min`/`max` already on the FormControl. These tests drive the
 * real rendered `p-inputNumber` (not `patchValue`, which would bypass
 * PrimeNG's clamping entirely and defeat the point of the regression test).
 */
describe('CreateListingFormComponent — compensation amount is not clamped by the input (regression)', () => {
  function goToStep3(
    fixture: ReturnType<typeof createComponent>['fixture'],
    component: CreateListingFormComponent,
  ) {
    component.currentStep.set(3);
    fixture.detectChanges();
  }

  /** Simulates the real blur path PrimeNG uses to commit a typed value,
   *  without needing full keystroke-by-keystroke input simulation. */
  function typeAndBlurCompensationInput(
    fixture: ReturnType<typeof createComponent>['fixture'],
    raw: string,
  ): void {
    const inputEl = fixture.nativeElement.querySelector('#wz-compensation') as HTMLInputElement;
    expect(inputEl).toBeTruthy();
    const instance = fixture.debugElement
      .queryAll(By.directive(InputNumber))
      .map((debugEl) => debugEl.componentInstance as InputNumber)
      .find((c) => c.inputId === 'wz-compensation');
    expect(instance).toBeTruthy();

    inputEl.value = raw;
    instance!.onInputBlur({ target: inputEl } as unknown as FocusEvent);
    fixture.detectChanges();
  }

  it('keeps a value above the 10,000,000 ֏ maximum exactly as typed (not clamped down)', () => {
    const { fixture, component } = createComponent('create');
    fillValidBasics(component);
    goToStep3(fixture, component);

    typeAndBlurCompensationInput(fixture, '20000000');

    expect(component.createListingForm.controls.compensationAmount.value).toBe(20000000);
    expect(component.createListingForm.controls.compensationAmount.hasError('max')).toBe(true);
  });

  it('keeps a value below the 1,000 ֏ minimum exactly as typed (not clamped up), and blocks Continue', () => {
    const { fixture, component } = createComponent('create');
    fillValidBasics(component);
    goToStep3(fixture, component);

    typeAndBlurCompensationInput(fixture, '500');

    expect(component.createListingForm.controls.compensationAmount.value).toBe(500);
    expect(component.createListingForm.controls.compensationAmount.hasError('min')).toBe(true);

    component.goToNextStep();
    expect(component.currentStep()).toBe(3);
  });

  it('an out-of-range amount blocks Continue at step 3 (the range error is reachable)', () => {
    const { fixture, component } = createComponent('create');
    fillValidBasics(component);
    goToStep3(fixture, component);

    typeAndBlurCompensationInput(fixture, '20000000');
    component.goToNextStep();

    expect(component.currentStep()).toBe(3);
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.comp-card .wizard-field__error');
    expect(errorEl).toBeTruthy();
  });
});
