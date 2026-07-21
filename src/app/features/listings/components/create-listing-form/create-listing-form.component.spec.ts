import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { CreateListingFormComponent } from './create-listing-form.component';
import type {
  ListingFormMode,
  ListingImageOrderItem,
} from './create-listing-form.component';
import type { CreateListingRequest } from '../../models/create-listing.model';
import type { ListingDistrict } from '../../models/district.model';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';

/**
 * Regression net for the create-listing wizard's Step-3 payload (confirmed
 * data-loss bug, fixed 2026-07-17).
 *
 * The wizard collects a minimum rental period and a delivery method, but
 * `onSubmit()` used to build `CreateListingRequest` WITHOUT them: both values
 * were silently dropped at submit and never reached the API. These tests pin the
 * contract that matters — the emitted `submitted` payload MUST carry:
 *   - `minRentalDays` as the chosen day-count NUMBER, and
 *   - `deliveryType` as the STRING union 'Pickup' | 'Courier' (never a number,
 *     never a Set — the API serializes the enum from a string via its global
 *     JsonStringEnumConverter).
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
}

function createComponent(mode: ListingFormMode = 'create') {
  TestBed.configureTestingModule({
    imports: [CreateListingFormComponent, TranslateModule.forRoot()],
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
    city: 'Yerevan',
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
  it('includes the chosen minRentalDays and deliveryType in the create payload', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    // Owner picks a 7-day minimum and courier delivery on Step 3.
    component.selectMinDays(7);
    component.selectDelivery('Courier');

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    const payload = event!.payload;

    // The regression: these two used to be absent from the payload entirely.
    expect(payload.minRentalDays).toBe(7);
    expect(payload.deliveryType).toBe('Courier');

    // Type discipline — deliveryType is the STRING union, never a number or Set.
    expect(typeof payload.minRentalDays).toBe('number');
    expect(typeof payload.deliveryType).toBe('string');
    expect((payload.deliveryType as unknown) instanceof Set).toBe(false);
  });

  it('carries the wizard defaults (1 day / Pickup) when the owner leaves Step 3 untouched', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    // No selectMinDays / selectDelivery calls: defaults must still be emitted,
    // not dropped (the bug emitted neither field regardless of selection).
    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.minRentalDays).toBe(1);
    expect(event!.payload.deliveryType).toBe('Pickup');
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
      city: 'Yerevan',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: 'Good',
      hygieneNotes: null,
      safetyNotes: null,
      minRentalDays: 14,
      deliveryType: 'Courier',
    };

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.minRentalDays).toBe(14);
    expect(event!.payload.deliveryType).toBe('Courier');
    // Edit mode emits an image order; sanity-check the field survived alongside it.
    expect(event!.imageOrder).not.toBeNull();
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
      city: 'Yerevan',
      ageFromMonths: 24,
      ageToMonths: 60,
      condition: null,
      hygieneNotes: null,
      safetyNotes: null,
      minRentalDays: null,
      deliveryType: null,
    };

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    // Must not emit null (which would re-introduce a different data-loss shape).
    expect(event!.payload.minRentalDays).toBe(1);
    expect(event!.payload.deliveryType).toBe('Pickup');
  });
});

/**
 * P1-6: the full-screen pin picker writes into the existing (previously
 * dead) `latitude`/`longitude` controls, and the optional district override
 * rides along in the same payload. `onLocationConfirmed` is exercised
 * directly here (bypassing the picker's own UI, which is unit-tested in
 * `location-picker.component.spec.ts`) so this stays a fast, DOM-free test of
 * the wiring between the two components.
 */
interface LocationWireable {
  onLocationConfirmed(coord: MapLatLng): void;
  pinCenter(): MapLatLng | null;
  hasPin(): boolean;
  showLocationPicker: { set(v: boolean): void };
}

const SAMPLE_DISTRICT: ListingDistrict = {
  id: 'd1111111-1111-1111-1111-111111111111',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

describe('CreateListingFormComponent — pin picker → payload (P1-6)', () => {
  it('confirming the picker populates the latitude/longitude form controls', () => {
    const { component } = createComponent('create');
    const wireable = component as unknown as LocationWireable;

    expect(wireable.hasPin()).toBe(false);
    expect(component.createListingForm.controls.latitude.value).toBeNull();
    expect(component.createListingForm.controls.longitude.value).toBeNull();

    wireable.onLocationConfirmed({ lat: 40.1776, lng: 44.5126 });

    expect(component.createListingForm.controls.latitude.value).toBe(40.1776);
    expect(component.createListingForm.controls.longitude.value).toBe(44.5126);
    expect(wireable.hasPin()).toBe(true);
    expect(wireable.pinCenter()).toEqual({ lat: 40.1776, lng: 44.5126 });
  });

  it('carries latitude/longitude/districtId in the create payload once set', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    (component as unknown as LocationWireable).onLocationConfirmed({ lat: 40.19, lng: 44.51 });
    component.createListingForm.controls.districtId.setValue(SAMPLE_DISTRICT.id);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.latitude).toBe(40.19);
    expect(event!.payload.longitude).toBe(44.51);
    expect(event!.payload.districtId).toBe(SAMPLE_DISTRICT.id);
  });

  it('still submits with null latitude/longitude/districtId when the owner never opens the picker (the pin stays optional)', () => {
    const { component } = createComponent('create');
    fillValidBasics(component);
    seedThreePhotos(component);

    const event = submitAndCapture(component);

    expect(event).not.toBeNull();
    expect(event!.payload.latitude).toBeNull();
    expect(event!.payload.longitude).toBeNull();
    expect(event!.payload.districtId).toBeNull();
  });
});
