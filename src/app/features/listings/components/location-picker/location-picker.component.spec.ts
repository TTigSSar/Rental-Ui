import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { LocationPickerComponent, YEREVAN_CENTER } from './location-picker.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';

/**
 * `app-map` (used inside this component's template) dynamic-imports the real
 * `leaflet` package. These tests care about the picker's OWN logic — resetting
 * the crosshair start point on open, confirm/cancel wiring, Escape/close
 * mapping — not Leaflet's rendering (covered by `map.component.spec.ts`), so
 * `leaflet` is stubbed out here too, keeping the dynamic import harmless.
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

/** Narrow accessor for the protected members under test. */
interface Testable {
  currentCenter(): MapLatLng;
  onCenterChange(center: MapLatLng): void;
  onVisibleChange(visible: boolean): void;
  confirm(): void;
  cancel(): void;
}

async function createPicker(open: boolean, initialCenter?: MapLatLng) {
  TestBed.configureTestingModule({
    imports: [LocationPickerComponent, TranslateModule.forRoot()],
  });
  const fixture = TestBed.createComponent(LocationPickerComponent);
  fixture.componentRef.setInput('open', open);
  if (initialCenter) fixture.componentRef.setInput('initialCenter', initialCenter);
  fixture.detectChanges();
  await vi.runAllTimersAsync();
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as unknown as Testable };
}

describe('LocationPickerComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts the crosshair on the Yerevan default when no pin was picked before', async () => {
    const { component } = await createPicker(true);
    expect(component.currentCenter()).toEqual(YEREVAN_CENTER);
  });

  it('starts the crosshair on the already-picked pin when re-opening', async () => {
    const previouslyPicked: MapLatLng = { lat: 40.19, lng: 44.51 };
    const { component } = await createPicker(true, previouslyPicked);
    expect(component.currentCenter()).toEqual(previouslyPicked);
  });

  it('confirms with the current centre when the owner never pans the map', async () => {
    const { component } = await createPicker(true, YEREVAN_CENTER);
    let emitted: MapLatLng | null = null;
    (component as unknown as LocationPickerComponent).confirmed.subscribe((c) => (emitted = c));

    component.confirm();

    expect(emitted).toEqual(YEREVAN_CENTER);
  });

  it('confirms with the panned-to coordinate after the map settles elsewhere', async () => {
    const { component } = await createPicker(true, YEREVAN_CENTER);
    let emitted: MapLatLng | null = null;
    (component as unknown as LocationPickerComponent).confirmed.subscribe((c) => (emitted = c));

    const panned: MapLatLng = { lat: 40.21, lng: 44.48 };
    component.onCenterChange(panned);
    component.confirm();

    expect(emitted).toEqual(panned);
  });

  it('emits cancelled when the Cancel button is activated', async () => {
    const { component } = await createPicker(true);
    let cancelledCount = 0;
    (component as unknown as LocationPickerComponent).cancelled.subscribe(() => cancelledCount++);

    component.cancel();

    expect(cancelledCount).toBe(1);
  });

  it('treats the dialog closing itself (Escape / header close button) as a cancel', async () => {
    const { component } = await createPicker(true);
    let cancelledCount = 0;
    (component as unknown as LocationPickerComponent).cancelled.subscribe(() => cancelledCount++);

    // PrimeNG's p-dialog emits `visibleChange(false)` for Escape and the header
    // close button alike — the picker maps both to the same cancel path.
    component.onVisibleChange(false);

    expect(cancelledCount).toBe(1);
  });

  it('resets the crosshair to the NEW initial centre each time the picker re-opens', async () => {
    const first: MapLatLng = { lat: 40.1, lng: 44.4 };
    const second: MapLatLng = { lat: 40.3, lng: 44.6 };

    const { fixture, component } = await createPicker(true, first);
    expect(component.currentCenter()).toEqual(first);

    fixture.componentRef.setInput('open', false);
    fixture.componentRef.setInput('initialCenter', second);
    fixture.detectChanges();

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(component.currentCenter()).toEqual(second);
  });
});
