import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { ListingsApiService } from '../../../features/listings/services/listings-api.service';
import type { ListingDistrict } from '../../../features/listings/models/district.model';
import { GeolocationService } from '../../services/geolocation.service';
import { YEREVAN_CENTER } from '../map/map.constants';
import { HomePointMapComponent } from './home-point-map.component';
import { LOW_ACCURACY_THRESHOLD_METERS, type HomePointSelection } from './home-point-map.model';

/**
 * `app-map` dynamic-imports the real `leaflet`. These tests are about THIS
 * component's own logic — the debounced district lookup, the "deliberate
 * choice" gate, the geolocation states — not Leaflet's rendering (covered by
 * `map.component.spec.ts`), so the package is stubbed the same way
 * `location-picker.component.spec.ts` stubs it.
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
  circle: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

const KENTRON: ListingDistrict = {
  id: 'd1111111-1111-1111-1111-111111111111',
  code: 'kentron',
  nameEn: 'Kentron',
  nameHy: 'Կենտրոն',
  nameRu: 'Кентрон',
};

/** Narrow accessor for the protected members under test. */
interface Testable {
  onCenterChange(center: { lat: number; lng: number }): void;
  requestMyLocation(): void;
  deliberate(): boolean;
  hasMoved(): boolean;
  outsideYerevan(): boolean;
  canConfirm(): boolean;
  resolving(): boolean;
  geoState(): string;
  lowAccuracyMeters(): number | null;
}

function setup(
  options: {
    district?: ListingDistrict | null;
    districtFails?: boolean;
    position?: { lat: number; lng: number; accuracyMeters: number | null };
    positionRejects?: boolean;
    openedOnExistingPoint?: boolean;
  } = {},
) {
  const getDistrictAt = vi.fn(() =>
    options.districtFails
      ? throwError(() => new Error('offline'))
      : of(options.district === undefined ? KENTRON : options.district),
  );
  const getCurrentPosition = vi.fn(() =>
    options.positionRejects
      ? Promise.reject(new Error('denied'))
      : Promise.resolve(options.position ?? { lat: 40.2, lng: 44.52, accuracyMeters: 25 }),
  );

  TestBed.configureTestingModule({
    imports: [HomePointMapComponent, TranslateModule.forRoot()],
    providers: [
      // `LanguageService` (injected for the district chip's display name) itself
      // injects `Store` to persist the user's language choice.
      provideMockStore(),
      { provide: ListingsApiService, useValue: { getDistrictAt } },
      { provide: GeolocationService, useValue: { getCurrentPosition } },
    ],
  });

  const fixture: ComponentFixture<HomePointMapComponent> =
    TestBed.createComponent(HomePointMapComponent);
  fixture.componentRef.setInput('openedOnExistingPoint', options.openedOnExistingPoint ?? false);

  const emitted: HomePointSelection[] = [];
  fixture.componentInstance.selectionChange.subscribe((s) => emitted.push(s));
  fixture.detectChanges();

  /**
   * Drains the component's arming lookup. Mounting runs an `effect()` that
   * re-centres the map and asks for the starting point's district — Angular
   * schedules that effect rather than running it inside `detectChanges()`, so
   * under fake timers it lands on the first `advanceTimersByTime` and would
   * otherwise reset the debounce window a test had just started. Two advances:
   * one to flush the effect, one for its own 400 ms debounce.
   */
  function flushArm(): void {
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(500);
    getDistrictAt.mockClear();
    emitted.length = 0;
  }

  return {
    fixture,
    component: fixture.componentInstance as unknown as Testable,
    emitted,
    getDistrictAt,
    getCurrentPosition,
    flushArm,
  };
}

/** Lets an already-resolved promise chain settle without touching timers. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
}

describe('HomePointMapComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructs and renders the map plus the district chip', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('app-map')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.hp-map__chip')).toBeTruthy();
  });

  /**
   * M-031: a geolocation permission is a shared, single-use, origin-wide
   * resource. This component must never spend it on mount — only on a tap of
   * the labelled control.
   */
  it('never asks the browser for a location on mount', () => {
    const { getCurrentPosition } = setup();

    vi.advanceTimersByTime(5000);

    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('debounces the district lookup by ~400 ms after panning stops', () => {
    const { component, getDistrictAt, flushArm } = setup();
    flushArm();

    component.onCenterChange({ lat: 40.18, lng: 44.51 });
    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    component.onCenterChange({ lat: 40.2, lng: 44.53 });

    // Mid-flight: still debouncing, nothing sent yet.
    vi.advanceTimersByTime(399);
    expect(getDistrictAt).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    // One request for the whole burst, for the LAST position.
    expect(getDistrictAt).toHaveBeenCalledTimes(1);
    expect(getDistrictAt).toHaveBeenCalledWith(40.2, 44.53);
  });

  /**
   * The `if (!moved) return` guard in `onCenterChange`.
   *
   * `app-map` reports `centerChange` on every Leaflet `moveend`, and
   * `moveend` fires for things that are not pans — including the
   * `invalidateSize()` its own ResizeObserver issues when the map's box
   * changes. The host resizes that box in response to THIS component's
   * output (it renders a status message beside the map), so without the
   * guard a lookup result re-fires `moveend` at an unchanged coordinate,
   * which starts another lookup: an endless ~450 ms request loop with the
   * chip stuck on "Checking the district…".
   *
   * The timers are advanced BETWEEN the two calls on purpose. A single
   * `advanceTimersByTime` after both would prove nothing: `debounceTime`
   * coalesces the pair into one request whether the guard is there or not,
   * which is exactly why the suite stayed green with the guard deleted.
   */
  it('a `centerChange` repeating the opening centre is neither a lookup nor a move', () => {
    const { component, getDistrictAt, flushArm } = setup();
    // The opening centre's own lookup already happened, on arm.
    flushArm();

    // `app-map`'s initial report, then the same coordinate again. Each gets a
    // full debounce window of its own, so a second request has every chance
    // to go out if the guard lets it.
    component.onCenterChange({ ...YEREVAN_CENTER });
    vi.advanceTimersByTime(400);
    component.onCenterChange({ ...YEREVAN_CENTER });
    vi.advanceTimersByTime(400);

    // One coordinate, one lookup — the armed one, and nothing after it.
    expect(getDistrictAt).not.toHaveBeenCalled();
    expect(component.hasMoved()).toBe(false);
    expect(component.resolving()).toBe(false);
  });

  it('a `centerChange` repeating the CURRENT centre after a real pan issues no second lookup', () => {
    const { component, getDistrictAt, flushArm } = setup();
    flushArm();

    // Consume `app-map`'s initial report, then pan for real: one lookup.
    component.onCenterChange({ ...YEREVAN_CENTER });
    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    vi.advanceTimersByTime(400);
    expect(getDistrictAt).toHaveBeenCalledTimes(1);
    expect(component.hasMoved()).toBe(true);

    // The resize-driven `moveend`: same coordinate, so nothing downstream
    // may hear about it. This is the emission that used to re-enter the
    // lookup → host resize → `invalidateSize` → `moveend` loop.
    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    vi.advanceTimersByTime(400);

    expect(getDistrictAt).toHaveBeenCalledTimes(1);
    expect(component.resolving()).toBe(false);
  });

  it('a resolved district enables Confirm once the map has actually moved', () => {
    const { component, flushArm } = setup();
    flushArm();

    // The very first `centerChange` is `app-map`'s initial report, not a pan.
    component.onCenterChange({ lat: 40.1776, lng: 44.5126 });
    vi.advanceTimersByTime(400);
    expect(component.deliberate()).toBe(false);
    expect(component.canConfirm()).toBe(false);

    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    vi.advanceTimersByTime(400);

    expect(component.deliberate()).toBe(true);
    expect(component.outsideYerevan()).toBe(false);
    expect(component.canConfirm()).toBe(true);
  });

  /**
   * Tigran's decision, superseding the boards: a point outside Yerevan is
   * REJECTED for everyone. `district: null` is the only refusal signal there
   * is — there is no separate "outside Armenia" tier.
   */
  it('a null district blocks Confirm and shows the red chip', () => {
    const { fixture, component, flushArm } = setup({ district: null });
    flushArm();

    component.onCenterChange({ lat: 40.1776, lng: 44.5126 });
    component.onCenterChange({ lat: 41.5, lng: 45.9 });
    vi.advanceTimersByTime(400);
    fixture.detectChanges();

    expect(component.deliberate()).toBe(true);
    expect(component.outsideYerevan()).toBe(true);
    expect(component.canConfirm()).toBe(false);
    expect(fixture.nativeElement.querySelector('.hp-map__chip--error')).toBeTruthy();
  });

  it('opening on an already-saved point counts as deliberate, so Confirm starts available', () => {
    const { component, flushArm } = setup({ openedOnExistingPoint: true });
    flushArm();

    component.onCenterChange({ lat: 40.1834, lng: 44.515 });
    vi.advanceTimersByTime(400);

    expect(component.deliberate()).toBe(true);
    expect(component.canConfirm()).toBe(true);
  });

  /**
   * A failed lookup must not read as "outside Yerevan" — that would disable
   * Confirm on a network blip and tell the owner their home is in the wrong
   * city.
   */
  it('a failed district lookup leaves the point confirmable rather than claiming it is outside Yerevan', () => {
    const { component, flushArm } = setup({ districtFails: true });
    flushArm();

    component.onCenterChange({ lat: 40.1776, lng: 44.5126 });
    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    vi.advanceTimersByTime(400);

    expect(component.outsideYerevan()).toBe(false);
    expect(component.resolving()).toBe(false);
    expect(component.canConfirm()).toBe(true);
  });

  describe('"Use my location"', () => {
    it('a fix arriving counts as a deliberate choice', async () => {
      const { component, flushArm } = setup({
        position: { lat: 40.21, lng: 44.53, accuracyMeters: 30 },
      });
      flushArm();

      component.requestMyLocation();
      await flushMicrotasks();

      expect(component.geoState()).toBe('idle');
      expect(component.deliberate()).toBe(true);
      expect(component.lowAccuracyMeters()).toBeNull();
    });

    /** M-027: carry the browser's own error bar all the way to the UI. */
    it(`flags a fix worse than ${LOW_ACCURACY_THRESHOLD_METERS} m as low-accuracy`, async () => {
      const { component, flushArm } = setup({
        position: { lat: 40.21, lng: 44.53, accuracyMeters: 820 },
      });
      flushArm();

      component.requestMyLocation();
      await flushMicrotasks();
      expect(component.lowAccuracyMeters()).toBe(820);

      // Still confirmable — the warning asks the owner to check the pin, it
      // does not take the decision away from them.
      component.onCenterChange({ lat: 40.21, lng: 44.53 });
      vi.advanceTimersByTime(400);
      expect(component.canConfirm()).toBe(true);
    });

    it('a fix exactly at the threshold is NOT flagged', async () => {
      const { component, flushArm } = setup({
        position: { lat: 40.21, lng: 44.53, accuracyMeters: LOW_ACCURACY_THRESHOLD_METERS },
      });
      flushArm();

      component.requestMyLocation();
      await flushMicrotasks();

      expect(component.geoState()).toBe('idle');
      expect(component.lowAccuracyMeters()).toBeNull();
    });

    it('a refusal lands in the soft `denied` state and never blocks the map', async () => {
      const { component, flushArm } = setup({ positionRejects: true });
      flushArm();

      component.requestMyLocation();
      await flushMicrotasks();
      expect(component.geoState()).toBe('denied');

      // Panning still works, and still gets you to a confirmable point.
      component.onCenterChange({ lat: 40.1776, lng: 44.5126 });
      component.onCenterChange({ lat: 40.19, lng: 44.52 });
      vi.advanceTimersByTime(400);
      expect(component.canConfirm()).toBe(true);
    });
  });

  it('reports every state change to its host', () => {
    const { component, emitted, flushArm } = setup();
    flushArm();

    component.onCenterChange({ lat: 40.1776, lng: 44.5126 });
    component.onCenterChange({ lat: 40.19, lng: 44.52 });
    vi.advanceTimersByTime(400);

    const last = emitted[emitted.length - 1];
    expect(last.center).toEqual({ lat: 40.19, lng: 44.52 });
    expect(last.district).toEqual(KENTRON);
    expect(last.canConfirm).toBe(true);
  });
});

/**
 * F6 — the chip's copy must WRAP, never truncate.
 *
 * The chip carries two readings of very different lengths: a one-word district
 * verdict ("Kentron") and a full instruction sentence ("Move the map so the pin
 * sits on your pickup spot", 30-40% longer again in RU/HY). It was styled for
 * the first, with `white-space: nowrap` + `text-overflow: ellipsis`, so at
 * 375 px the second rendered as "Move the map so the pin sits o..." - and that
 * reading IS the instruction, so clipping it removes the only thing telling the
 * owner what to do.
 *
 * jsdom has no layout, so it cannot measure a clip (same blind spot as M-024's
 * family) - the live 375 px check is what proves the rendering. What jsdom CAN
 * see, and what fully determines the behaviour, is the cascaded style on the
 * element: `nowrap` + `ellipsis` is the truncation, its absence is the wrap.
 */
describe('district chip copy wraps instead of truncating (F6)', () => {
  function chipTitleStyle(fixture: ComponentFixture<HomePointMapComponent>) {
    const title = fixture.nativeElement.querySelector('.hp-map__chip-copy b') as HTMLElement | null;
    expect(title).toBeTruthy();
    return getComputedStyle(title as HTMLElement);
  }

  it('does not pin the chip title to a single line', () => {
    const { fixture } = setup();
    expect(chipTitleStyle(fixture).whiteSpace).not.toBe('nowrap');
  });

  it('does not clip the chip title with an ellipsis', () => {
    const { fixture } = setup();
    expect(chipTitleStyle(fixture).textOverflow).not.toBe('ellipsis');
  });

  it('still renders the full instruction string, not a shortened one', () => {
    const { fixture } = setup();
    const title = fixture.nativeElement.querySelector('.hp-map__chip-copy b') as HTMLElement;
    // Untranslated TestBed: `| translate` echoes the key. The point of the
    // assertion is that the "move the map" reading is what a fresh chip shows,
    // so the string under test in the live check is this one.
    expect(title.textContent?.trim()).toBe('homePoint.map.moveHint');
  });
});
