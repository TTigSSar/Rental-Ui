import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ListingsApiService } from '../../../features/listings/services/listings-api.service';
import type { HomePointSelection } from '../home-point-map/home-point-map.model';

import { GeolocationService } from '../../services/geolocation.service';
import { LocationPickerComponent } from './location-picker.component';
import { MapComponent } from '../map/map.component';
import type { MapLatLng } from '../map/map.component';
import { YEREVAN_CENTER } from '../map/map.constants';

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
  // Needed since `MapComponent`'s `syncCircle()` now runs in `crosshair` mode
  // too (this picker's `effectiveRadiusPreviewMeters`/`circleDashed` wiring
  // below) — without this, `L.circle(...)` would be `undefined` and throw,
  // which `map.component.ts`'s `init()` catch would swallow into a spurious
  // `mapError` for every test in this file, not just the radius-preview ones.
  circle: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

/** Narrow accessor for the protected members under test. */
interface Testable {
  currentCenter(): MapLatLng;
  hasMoved(): boolean;
  mapCenter(): MapLatLng;
  effectiveRadiusPreviewMeters(): number | null;
  onCenterChange(center: MapLatLng): void;
  onVisibleChange(visible: boolean): void;
  requestMyLocation(): void;
  confirm(): void;
  cancel(): void;
}

async function createPicker(
  open: boolean,
  initialCenter?: MapLatLng,
  extraInputs?: Record<string, unknown>,
) {
  const geolocation = { getCurrentPosition: vi.fn() };
  TestBed.configureTestingModule({
    imports: [LocationPickerComponent, TranslateModule.forRoot()],
    providers: [{ provide: GeolocationService, useValue: geolocation }],
  });
  const fixture = TestBed.createComponent(LocationPickerComponent);
  fixture.componentRef.setInput('open', open);
  if (initialCenter) fixture.componentRef.setInput('initialCenter', initialCenter);
  if (extraInputs) {
    for (const [key, value] of Object.entries(extraInputs)) {
      fixture.componentRef.setInput(key, value);
    }
  }
  fixture.detectChanges();
  await vi.runAllTimersAsync();
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance as unknown as Testable,
    geolocation,
  };
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

  describe('confirmDisabledUntilMoved / hasMoved (screen 5 — reference-point picker)', () => {
    it('has NOT moved yet right after opening — the crosshair mode\'s own "report the starting centre" emission is not a real pan', async () => {
      const { component } = await createPicker(true, YEREVAN_CENTER);
      expect(component.hasMoved()).toBe(false);
    });

    it('becomes "moved" after a SECOND centre report — the first ever report (real or, here, simulated) never counts as a pan', async () => {
      const { component } = await createPicker(true, YEREVAN_CENTER);
      expect(component.hasMoved()).toBe(false);

      // This spec's mocked `leaflet.map()` never reaches `MapComponent`'s own
      // crosshair "report the starting centre" call (its mocked `tileLayer()`
      // doesn't return a real layer, so `init()` throws before getting there
      // and falls back to `mapError` — a limitation of this lightweight mock,
      // not of the real map). So the FIRST `onCenterChange` call here plays
      // the part that real Leaflet's own initial report would in production;
      // it must not count as a pan either way — only the second call should.
      component.onCenterChange(YEREVAN_CENTER);
      expect(component.hasMoved()).toBe(false);

      component.onCenterChange({ lat: 40.2, lng: 44.49 });
      expect(component.hasMoved()).toBe(true);
    });

    it('disables the confirm button in the DOM until the map has moved, when confirmDisabledUntilMoved is set', async () => {
      const { fixture, component } = await createPicker(true, YEREVAN_CENTER, {
        confirmDisabledUntilMoved: true,
      });
      // `p-dialog` portals its content to `document.body` (`appendTo="body"`),
      // NOT `fixture.nativeElement` — same reasoning as `auth-dialog`'s own
      // dialog usage elsewhere in this codebase.
      const confirmBtn = () =>
        document.body.querySelector<HTMLButtonElement>('.location-picker__btn--confirm');

      expect(confirmBtn()?.disabled).toBe(true);

      // Two reports needed in THIS spec's mock — see the previous test's
      // comment for why the first one doesn't count as a pan.
      component.onCenterChange(YEREVAN_CENTER);
      component.onCenterChange({ lat: 40.2, lng: 44.49 });
      fixture.detectChanges();

      expect(confirmBtn()?.disabled).toBe(false);
    });

    it("never disables the confirm button when confirmDisabledUntilMoved is left at its default (the wizard's own behaviour, unaffected)", async () => {
      await createPicker(true, YEREVAN_CENTER);
      const confirmBtn = document.body.querySelector<HTMLButtonElement>(
        '.location-picker__btn--confirm',
      );
      expect(confirmBtn?.disabled).toBe(false);
    });
  });

  describe('showMyLocationButton / requestMyLocation', () => {
    it('recentres the map once geolocation resolves', async () => {
      const { component, geolocation } = await createPicker(true, YEREVAN_CENTER, {
        showMyLocationButton: true,
      });
      geolocation.getCurrentPosition.mockResolvedValue({ lat: 40.25, lng: 44.55 });

      component.requestMyLocation();
      await Promise.resolve();

      expect(component.mapCenter()).toEqual({ lat: 40.25, lng: 44.55 });
    });

    it('leaves the crosshair where it was if geolocation fails — a convenience shortcut, not a hard requirement', async () => {
      const { component, geolocation } = await createPicker(true, YEREVAN_CENTER, {
        showMyLocationButton: true,
      });
      geolocation.getCurrentPosition.mockRejectedValue(new Error('denied'));

      component.requestMyLocation();
      await Promise.resolve();

      expect(component.mapCenter()).toEqual(YEREVAN_CENTER);
    });
  });

  // Regression for the defect this replaced: the preview used to be a CSS
  // `div` sized once from the zoom the picker opened at (`previewDiameterPx`)
  // — it drifted from the actual search radius as soon as the visitor zoomed.
  // It's now `app-map`'s own real geographic `circleRadiusMeters` layer (see
  // `map.component.ts`'s `syncCircle()`), which Leaflet itself keeps at the
  // correct size through any zoom change — so this spec only needs to check
  // the WIRING (the right value reaches `app-map`, gated by `hasMoved()`
  // exactly like before), not any on-screen pixel math.
  describe('radiusPreviewMeters (dashed preview circle, now a real app-map geographic layer)', () => {
    function mapCircleRadiusMeters(fixture: ReturnType<typeof TestBed.createComponent>) {
      const mapDebugEl = fixture.debugElement.query(By.directive(MapComponent));
      return (mapDebugEl.componentInstance as MapComponent).circleRadiusMeters();
    }

    it('passes no circleRadiusMeters to app-map when radiusPreviewMeters is null (default)', async () => {
      const { fixture } = await createPicker(true, YEREVAN_CENTER);
      expect(mapCircleRadiusMeters(fixture)).toBeNull();
    });

    it('still withholds circleRadiusMeters from app-map when a radius IS supplied but the crosshair has not moved yet', async () => {
      const { fixture, component } = await createPicker(true, YEREVAN_CENTER, {
        radiusPreviewMeters: 2000,
      });
      expect(component.hasMoved()).toBe(false);
      expect(mapCircleRadiusMeters(fixture)).toBeNull();
    });

    it('passes the radius through to app-map, dashed, once the crosshair has moved', async () => {
      const { fixture, component } = await createPicker(true, YEREVAN_CENTER, {
        radiusPreviewMeters: 2000,
      });
      // Two reports needed in this spec's mock — see the `hasMoved` describe
      // block above for why the first never counts as a real pan.
      component.onCenterChange(YEREVAN_CENTER);
      component.onCenterChange({ lat: 40.2, lng: 44.49 });
      fixture.detectChanges();

      expect(component.hasMoved()).toBe(true);
      expect(mapCircleRadiusMeters(fixture)).toBe(2000);
      const mapDebugEl = fixture.debugElement.query(By.directive(MapComponent));
      expect((mapDebugEl.componentInstance as MapComponent).circleDashed()).toBe(true);
    });

    it('updates the radius app-map receives when radiusPreviewMeters changes (post-move)', async () => {
      const { fixture, component } = await createPicker(true, YEREVAN_CENTER, {
        radiusPreviewMeters: 500,
      });
      component.onCenterChange(YEREVAN_CENTER);
      component.onCenterChange({ lat: 40.2, lng: 44.49 });
      fixture.detectChanges();
      expect(mapCircleRadiusMeters(fixture)).toBe(500);

      fixture.componentRef.setInput('radiusPreviewMeters', 5000);
      fixture.detectChanges();

      expect(mapCircleRadiusMeters(fixture)).toBe(5000);
    });
  });

  // Regression for a confirmed live-verification defect: the hint card used
  // to be ONE element (`.location-picker__hint`) that was both the visible
  // white card AND its own `left:14/right:14` positioning box, so its
  // background stretched edge-to-edge across the map on desktop widths —
  // physically covering app-map's top-right zoom stack (z-index 1002 vs.
  // this element's 1003), so neither a mouse click nor a touch tap could
  // reach the zoom buttons, and a `mousedown` anywhere in that top strip hit
  // the hint instead of starting a map drag.
  //
  // jsdom cannot lay out real pixel geometry (no bounding-box overlap check
  // is possible here — that part is only verifiable in a real browser; see
  // this PR's report), so this checks the two things jsdom *can* see and
  // that together fully describe the fix: (1) the hollow positioning box and
  // the visible card are now separate elements, not one merged node, and
  // (2) the stylesheet gives the hollow box `pointer-events: none` and the
  // visible card `pointer-events: auto` — the split that stops the
  // full-width box from swallowing clicks/drags meant for whatever is
  // beneath it, independent of z-index. A test that only checked for the
  // `.location-picker__hint` class's continued presence would have passed
  // on the original single-element, click-swallowing markup too — this one
  // fails on it, because that markup had no separate `.location-picker__
  // hint-card` element and no `pointer-events` split at all.
  describe('hint card must not intercept clicks/drags meant for the map (zoom-button overlap regression)', () => {
    it('renders the visible card as a NESTED element, separate from the full-width positioning box', async () => {
      await createPicker(true, YEREVAN_CENTER, { hintTitleKey: 'some.key' });
      const hintBox = document.body.querySelector('.location-picker__hint');
      const hintCard = document.body.querySelector('.location-picker__hint-card');

      expect(hintBox).toBeTruthy();
      expect(hintCard).toBeTruthy();
      // Must be two distinct elements, one containing the other — NOT the
      // same node wearing two classes (that would put the visible card's
      // own background back on the full-width box).
      expect(hintBox).not.toBe(hintCard);
      expect(hintBox?.contains(hintCard)).toBe(true);
    });

    it('gives the full-width positioning box pointer-events: none and the visible card pointer-events: auto', async () => {
      await createPicker(true, YEREVAN_CENTER, { hintTitleKey: 'some.key' });
      const hintBox = document.body.querySelector<HTMLElement>('.location-picker__hint');
      const hintCard = document.body.querySelector<HTMLElement>('.location-picker__hint-card');

      expect(hintBox).toBeTruthy();
      expect(hintCard).toBeTruthy();
      expect(getComputedStyle(hintBox as HTMLElement).pointerEvents).toBe('none');
      expect(getComputedStyle(hintCard as HTMLElement).pointerEvents).toBe('auto');
    });
  });
});

/**
 * Home-point mode (`homePointMode`) — the same full-screen dialog shell, but the
 * body is `app-home-point-map` and Confirm is GATED: enabled only when the
 * point is both valid (inside Yerevan) and deliberately chosen.
 *
 * Deviation from the approved boards, decided after they were drawn: a point
 * outside Yerevan is the ONE blocking state, for everyone. The boards had
 * "Outside Yerevan" as a neutral, still-confirmable chip and blocked only
 * "outside Armenia"; that distinction no longer exists anywhere — backend
 * included, which answers `auth.home_point_outside_yerevan` for both.
 */
describe('LocationPickerComponent — home-point mode', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  interface HomePointTestable {
    onHomePointSelectionChange(selection: HomePointSelection): void;
    homePointConfirmDisabled(): boolean;
    confirm(): void;
  }

  const SELECTION: HomePointSelection = {
    center: { lat: 40.19, lng: 44.51 },
    district: {
      id: 'd1111111-1111-1111-1111-111111111111',
      code: 'kentron',
      nameEn: 'Kentron',
      nameHy: 'Կենտրոն',
      nameRu: 'Кентрон',
    },
    resolving: false,
    outsideYerevan: false,
    deliberate: true,
    geoState: 'idle',
    lowAccuracyMeters: null,
    canConfirm: true,
  };

  async function createHomePointPicker(extraInputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [LocationPickerComponent, TranslateModule.forRoot()],
      providers: [
        // `LanguageService` (via the district chip) injects `Store`.
        provideMockStore(),
        { provide: GeolocationService, useValue: { getCurrentPosition: vi.fn() } },
        { provide: ListingsApiService, useValue: { getDistrictAt: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(LocationPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('homePointMode', true);
    for (const [key, value] of Object.entries(extraInputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance as unknown as HomePointTestable,
      instance: fixture.componentInstance,
    };
  }

  it('renders the home-point map and the two-line header instead of the generic crosshair map', async () => {
    const { fixture } = await createHomePointPicker();

    expect(document.querySelector('app-home-point-map')).toBeTruthy();
    expect(document.querySelector('.location-picker__subtitle')).toBeTruthy();
    expect(document.querySelector('.location-picker__hint')).toBeNull();
    expect(fixture.nativeElement).toBeTruthy();
  });

  it('Confirm is disabled until the map reports a confirmable selection', async () => {
    const { component } = await createHomePointPicker();

    expect(component.homePointConfirmDisabled()).toBe(true);

    component.onHomePointSelectionChange(SELECTION);

    expect(component.homePointConfirmDisabled()).toBe(false);
  });

  it('a point outside Yerevan keeps Confirm disabled and emits nothing', async () => {
    const { component, instance } = await createHomePointPicker();
    let emitted = 0;
    instance.confirmed.subscribe(() => (emitted += 1));

    component.onHomePointSelectionChange({
      ...SELECTION,
      district: null,
      outsideYerevan: true,
      canConfirm: false,
    });

    expect(component.homePointConfirmDisabled()).toBe(true);
    component.confirm();
    expect(emitted).toBe(0);
  });

  it('Confirm emits BOTH the coordinate and the resolved district, so the caller need not look it up again', async () => {
    const { component, instance } = await createHomePointPicker();
    let coord: MapLatLng | null = null;
    let selection: HomePointSelection | null = null;
    instance.confirmed.subscribe((c) => (coord = c));
    instance.confirmedHomePoint.subscribe((s) => (selection = s));

    component.onHomePointSelectionChange(SELECTION);
    component.confirm();

    expect(coord).toEqual(SELECTION.center);
    expect(selection).toEqual(SELECTION);
  });

  it('a save in flight makes Confirm inert', async () => {
    const { component, fixture } = await createHomePointPicker();
    component.onHomePointSelectionChange(SELECTION);
    expect(component.homePointConfirmDisabled()).toBe(false);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();

    expect(component.homePointConfirmDisabled()).toBe(true);
  });

  it('a server-side refusal reaches the inline status message', async () => {
    const { fixture } = await createHomePointPicker({ serverOutsideYerevan: true });
    fixture.detectChanges();

    expect(document.querySelector('.hp-status--error')).toBeTruthy();
  });
});

/**
 * A11y regressions found by the verifier on the live home-point picker (F5).
 *
 * Both are construction/DOM-level facts, so both go through a real
 * `TestBed.createComponent` and read the real portalled DOM rather than
 * asserting on component state (M-028): the first defect was invisible to
 * every existing test precisely because no test had ever looked at the
 * dialog element's own attributes, and the second because no test had ever
 * moved focus.
 */
describe('LocationPickerComponent — dialog accessible name (F5.1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** The portalled dialog root — `appendTo="body"`, so NOT under the fixture. */
  function dialogRoot(): HTMLElement {
    const root = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(root).toBeTruthy();
    return root as HTMLElement;
  }

  /** Resolves the dialog's `aria-labelledby` exactly as a screen reader would. */
  function accessibleName(): string {
    const id = dialogRoot().getAttribute('aria-labelledby');
    expect(id).toBeTruthy();
    const labelEl = document.getElementById(id as string);
    // The defect: this element did not exist at all. `p-dialog` only renders
    // the default title span carrying this id when NO header template is
    // supplied, but it binds `aria-labelledby` to the id either way.
    expect(labelEl).toBeTruthy();
    return (labelEl?.textContent ?? '').trim();
  }

  it('home-point mode exposes a NON-EMPTY accessible name from its own two-line header', async () => {
    TestBed.configureTestingModule({
      imports: [LocationPickerComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore(),
        { provide: GeolocationService, useValue: { getCurrentPosition: vi.fn() } },
        { provide: ListingsApiService, useValue: { getDistrictAt: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(LocationPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('homePointMode', true);
    fixture.componentRef.setInput('headerKey', 'homePoint.picker.title');
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    // No translations are registered in this TestBed, so `| translate` echoes
    // the key — which is what makes "non-empty" meaningful here: the broken
    // version resolved to no element at all, not to an untranslated string.
    expect(accessibleName()).toBe('homePoint.picker.title');

    // ...and the name must come from the visible <h2>, not a hidden duplicate:
    // two elements sharing the id would let the empty one win on document
    // order, which is the exact shape of the original bug.
    const id = dialogRoot().getAttribute('aria-labelledby') as string;
    // Attribute selector rather than `#id` + `CSS.escape` — jsdom does not
    // implement `CSS.escape`, and the generated id needs no escaping anyway.
    expect(document.body.querySelectorAll('[id="' + id + '"]').length).toBe(1);
    expect(document.getElementById(id)?.tagName).toBe('H2');
    expect(document.getElementById(id)?.classList.contains('location-picker__title')).toBe(true);
  });

  it('generic mode (plain [header] string, no header template) keeps its accessible name', async () => {
    await createPicker(true, YEREVAN_CENTER, {
      headerKey: 'listings.filters.locationPicker.title',
    });

    expect(accessibleName()).toBe('listings.filters.locationPicker.title');
  });
});

/**
 * F5.2 — focus must come back to whatever opened the picker. PrimeNG does not
 * do this (`onContainerDestroy` in `primeng-dialog.mjs` touches z-index,
 * modality and body scroll and nothing else), and the doc comment used to make
 * it the caller's job, which exactly one of four call sites actually did.
 *
 * The host below is a REAL component with a REAL trigger button, because the
 * thing under test is `document.activeElement` — there is no way to assert it
 * from component state.
 */
@Component({
  standalone: true,
  imports: [LocationPickerComponent],
  template: `
    <button type="button" class="spec-trigger" (click)="open.set(true)">open the picker</button>
    <app-location-picker
      [open]="open()"
      [homePointMode]="true"
      (cancelled)="open.set(false)"
      (confirmed)="open.set(false)"
    />
  `,
})
class PickerHostComponent {
  readonly open = signal(false);
}

describe('LocationPickerComponent — focus return to the trigger (F5.2)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  interface CloseTestable {
    onVisibleChange(visible: boolean): void;
  }

  async function openFromTrigger() {
    TestBed.configureTestingModule({
      imports: [PickerHostComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore(),
        { provide: GeolocationService, useValue: { getCurrentPosition: vi.fn() } },
        { provide: ListingsApiService, useValue: { getDistrictAt: vi.fn(() => of(null)) } },
      ],
    });
    const fixture = TestBed.createComponent(PickerHostComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.spec-trigger') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    // Stand in for `p-dialog`'s own `focusOnShow`, which fires from a motion
    // callback jsdom never runs. Without this the test would pass against the
    // BROKEN code too — focus would simply never have left the trigger.
    const cancelBtn = document.body.querySelector<HTMLButtonElement>(
      '.location-picker__btn--cancel',
    );
    expect(cancelBtn).toBeTruthy();
    cancelBtn?.focus();
    expect(document.activeElement).toBe(cancelBtn);

    return {
      fixture,
      trigger,
      cancelBtn: cancelBtn as HTMLButtonElement,
      picker: fixture.debugElement.query(By.directive(LocationPickerComponent))
        .componentInstance as unknown as CloseTestable,
    };
  }

  it('returns focus to the trigger when the Cancel button is pressed', async () => {
    const { fixture, trigger, cancelBtn } = await openFromTrigger();

    cancelBtn.click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the trigger on Escape / the header close button', async () => {
    const { fixture, trigger, picker } = await openFromTrigger();

    // The exact path Escape takes: PrimeNG's document keydown handler calls
    // `close()` -> `hide()` -> `visibleChange(false)`. The live defect was that
    // `document.activeElement` became BODY here.
    picker.onVisibleChange(false);
    fixture.detectChanges();

    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(trigger);
  });

  it('re-captures the trigger on every re-open rather than reusing the first one', async () => {
    const { fixture, trigger, picker } = await openFromTrigger();
    picker.onVisibleChange(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    // Second journey, opened from a DIFFERENT control.
    const other = document.createElement('button');
    other.type = 'button';
    fixture.nativeElement.appendChild(other);
    other.focus();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    document.body.querySelector<HTMLButtonElement>('.location-picker__btn--cancel')?.focus();
    picker.onVisibleChange(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(other);
  });
});
