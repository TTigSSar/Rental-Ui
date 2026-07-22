import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MapComponent, resolveTileSource, TILE_PROVIDER_CONFIG } from './map.component';
import type { MapLatLng } from './map.component';

/**
 * `app-map` is the only file allowed to import `leaflet` (see the class doc
 * comment) — everything else, including this spec, must stay ignorant of the
 * real library. Mocking the module lets these tests pin down the *wiring*
 * (which options Leaflet gets, marker add/remove, `centerChange` emission)
 * without needing a real DOM-measured map or network tiles.
 */
const state = vi.hoisted(() => ({
  mapOptions: null as Record<string, unknown> | null,
  tileLayerCalls: [] as {
    url: string;
    options: Record<string, unknown>;
    handlers: Record<string, (() => void)[]>;
  }[],
  markerCalls: [] as { coords: [number, number]; options: Record<string, unknown> }[],
  circleCalls: [] as { coords: [number, number]; options: Record<string, unknown> }[],
  removedLayers: [] as unknown[],
  moveendHandlers: [] as (() => void)[],
  fakeCenter: { lat: 40.1776, lng: 44.5126 },
  mapRemoved: false,
  mapThrows: false,
  // Reassigned to the most recently created fake map's `invalidateSize` spy —
  // lets tests assert the ResizeObserver wiring calls it without needing a
  // handle on the map instance itself (which `map.component.ts` never exposes).
  lastInvalidateSize: null as ReturnType<typeof vi.fn> | null,
}));

function makeFakeMap(options: Record<string, unknown>) {
  state.mapOptions = options;
  const invalidateSize = vi.fn();
  state.lastInvalidateSize = invalidateSize;
  return {
    setView: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'moveend') state.moveendHandlers.push(handler);
    }),
    getCenter: vi.fn(() => state.fakeCenter),
    invalidateSize,
    removeLayer: vi.fn((layer: unknown) => state.removedLayers.push(layer)),
    remove: vi.fn(() => {
      state.mapRemoved = true;
    }),
  };
}

/**
 * jsdom has no native `ResizeObserver` — this fake stands in for the global so
 * `map.component.ts`'s `new ResizeObserver(...)` doesn't throw, and lets tests
 * both assert the wiring (`observe()` called with the map container) and
 * simulate a real box-resize by invoking the captured callback directly. One
 * instance is expected per mounted `app-map`; `resizeObserverInstances` is
 * reset in `beforeEach` below.
 */
let resizeObserverInstances: FakeResizeObserver[] = [];
class FakeResizeObserver {
  readonly observed: unknown[] = [];
  disconnected = false;
  constructor(private readonly callback: () => void) {
    resizeObserverInstances.push(this);
  }
  observe(target: unknown): void {
    this.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
  /** Simulates the browser reporting a real box-size change. */
  trigger(): void {
    this.callback();
  }
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver);

// Mocked as CJS-default-only — i.e. `{ default: { map, tileLayer, ... } }`
// with NO flattened top-level named exports — because that is the exact
// shape a production `ng build` (esbuild) produces for this dynamic import,
// as opposed to `ng serve` (Vite), which flattens them onto the namespace
// object directly. `map.component.ts`'s `resolveLeafletModule()` must unwrap
// this; mocking the harsher of the two real shapes means every test below
// also guards against regressing back to calling `L.map(...)` on the raw
// import result (see the bug this fixed: that call silently threw
// "L.map is not a function" and was swallowed into `mapError` in every
// production build).
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      if (state.mapThrows) throw new Error('boom');
      return makeFakeMap(options);
    }),
    tileLayer: vi.fn((url: string, options: Record<string, unknown>) => {
      const handlers: Record<string, (() => void)[]> = {};
      const layer = {
        addTo: vi.fn(() => layer),
        on: vi.fn((event: string, handler: () => void) => {
          (handlers[event] ??= []).push(handler);
          return layer;
        }),
      };
      state.tileLayerCalls.push({ url, options, handlers });
      return layer;
    }),
    marker: vi.fn((coords: [number, number], options: Record<string, unknown>) => {
      state.markerCalls.push({ coords, options });
      return { addTo: vi.fn() };
    }),
    circle: vi.fn((coords: [number, number], options: Record<string, unknown>) => {
      state.circleCalls.push({ coords, options });
      return { addTo: vi.fn() };
    }),
    divIcon: vi.fn((options: Record<string, unknown>) => ({ __divIcon: true, ...options })),
  },
}));

@Component({
  standalone: true,
  imports: [MapComponent],
  template: `
    <app-map
      [center]="center"
      [zoom]="zoom"
      [pin]="pin"
      [interactive]="interactive"
      [crosshair]="crosshair"
      [circleRadiusMeters]="circleRadiusMeters"
      (centerChange)="onCenterChange($event)"
      (mapError)="onMapError()"
    />
  `,
})
class MapHostComponent {
  center: MapLatLng = { lat: 40.1776, lng: 44.5126 };
  zoom = 13;
  pin: MapLatLng | null = null;
  interactive = false;
  crosshair = false;
  circleRadiusMeters: number | null = null;
  received: MapLatLng[] = [];
  errorCount = 0;
  onCenterChange(c: MapLatLng): void {
    this.received.push(c);
  }
  onMapError(): void {
    this.errorCount++;
  }
}

async function createHost() {
  TestBed.configureTestingModule({ imports: [MapHostComponent] });
  const fixture = TestBed.createComponent(MapHostComponent);
  fixture.detectChanges(); // triggers ngAfterViewInit -> the dynamic import('leaflet')
  await vi.runAllTimersAsync();
  fixture.detectChanges();
  return fixture;
}

describe('MapComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.mapOptions = null;
    state.tileLayerCalls = [];
    state.markerCalls = [];
    state.circleCalls = [];
    state.removedLayers = [];
    state.moveendHandlers = [];
    state.fakeCenter = { lat: 40.1776, lng: 44.5126 };
    state.mapRemoved = false;
    state.mapThrows = false;
    state.lastInvalidateSize = null;
    resizeObserverInstances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Deliberately the first tests in the file: `resolveTileSource()`'s "warn
  // once" flag is module-level (see map.component.ts) and shared with every
  // other test below (which mounts the real component against the real,
  // checked-in `environment.ts` — apiKey always ''), so this must run first
  // to observe the warning transition from "not yet fired" to "fired".
  //
  // `resolveTileSource` is called directly (exported for exactly this) with
  // a fake provider config, rather than through the mounted component: the
  // Angular vitest builder in this repo rejects `vi.mock()` on relative
  // imports ("not supported for relative imports with the Angular unit-test
  // system"), so the `environment` module itself cannot be mocked to flip
  // between "no key" and "key configured" scenarios.
  it('resolveTileSource: warns once and falls back to OpenStreetMap tiles when no provider key is configured', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fakeProvider = {
      urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
      apiKey: '',
      attribution: '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a>',
      maxZoom: 20,
    };

    const first = resolveTileSource(fakeProvider);

    expect(first.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(first.attribution).toContain('OpenStreetMap contributors');
    expect(first.maxZoom).toBe(19);
    expect(first.isFallback).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('tileProvider.apiKey');

    // Calling again with the key still empty must not warn a second time.
    resolveTileSource(fakeProvider);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('resolveTileSource: builds the configured provider URL from its template and key once a provider key is set', () => {
    const fakeProvider = {
      urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
      apiKey: 'dummy-test-key',
      attribution: '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a>',
      maxZoom: 20,
    };

    const result = resolveTileSource(fakeProvider);

    expect(result.url).toBe(
      'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=dummy-test-key',
    );
    expect(result.maxZoom).toBe(20);
    expect(result.attribution).toBe(fakeProvider.attribution);
    expect(result.isFallback).toBe(false);
  });

  // Regression for the patchy-tiles bug: Leaflet creates its pane/tile/control
  // DOM imperatively, outside Angular's template, so it never receives the
  // `_ngcontent-*`/`_nghost-*` attributes Angular's default `Emulated`
  // encapsulation stamps on template-created nodes and scopes this
  // component's compiled CSS (including the whole `leaflet.css` pulled in via
  // `@use`) to require. Under `Emulated`, every `leaflet.css` rule silently
  // failed to match a single real tile, so tiles kept the UA default
  // `position: static` instead of Leaflet's intended `absolute`, and rendered
  // stacked in document flow instead of positioned — see the class doc
  // comment for the full mechanism and how this was confirmed live. Asserting
  // on the rendered host/template elements (rather than reaching into
  // Angular's private `ɵcmp` metadata) keeps this test meaningful even if
  // Angular changes its internal encapsulation implementation.
  it('renders with encapsulation OFF so Leaflet-created DOM is reachable by leaflet.css selectors', async () => {
    const fixture = await createHost();

    const host: HTMLElement = fixture.nativeElement.querySelector('app-map');
    const child: HTMLElement = fixture.nativeElement.querySelector('.app-map__surface');
    const attrNames = (el: HTMLElement) => Array.from(el.attributes).map((a) => a.name);

    expect(attrNames(host).some((n) => n.startsWith('_nghost'))).toBe(false);
    expect(attrNames(child).some((n) => n.startsWith('_ngcontent'))).toBe(false);
  });

  it('creates the map centred on the given coordinate and zoom, static (non-interactive) by default', async () => {
    await createHost();

    expect(state.mapOptions).not.toBeNull();
    expect(state.mapOptions!['center']).toEqual([40.1776, 44.5126]);
    expect(state.mapOptions!['zoom']).toBe(13);
    // Static mode: no pan/zoom/drag affordances.
    expect(state.mapOptions!['dragging']).toBe(false);
    expect(state.mapOptions!['zoomControl']).toBe(false);
    expect(state.mapOptions!['scrollWheelZoom']).toBe(false);
    // Attribution is mandatory (ODbL) regardless of interactivity.
    expect(state.mapOptions!['attributionControl']).toBe(true);
  });

  it('enables pan/zoom/drag when interactive=true', async () => {
    // Inputs are read once at map-creation time, so set interactive=true
    // BEFORE the first detectChanges() rather than mutating a live instance.
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.interactive = true;
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.mapOptions!['dragging']).toBe(true);
    expect(state.mapOptions!['zoomControl']).toBe(true);
    expect(state.mapOptions!['scrollWheelZoom']).toBe(true);
  });

  // Provides its own `TILE_PROVIDER_CONFIG` via `TestBed` instead of relying
  // on whatever happens to be in the checked-in `environment.ts` at test time
  // (its checked-in default is an empty key — see the field comment there) —
  // this is exactly the seam `TILE_PROVIDER_CONFIG` exists for. Covers both
  // the configured-provider URL construction AND the MapTiler logo
  // requirement in one scenario, since both are gated on the same
  // "a key is configured" fact (see `ResolvedTileSource.isFallback`'s doc
  // comment in map.component.ts).
  it('builds the configured provider tile URL and renders the MapTiler logo when a provider key is configured', async () => {
    const fakeConfig = {
      urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
      apiKey: 'test-key-123',
      attribution: '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a>',
      maxZoom: 20,
    };
    TestBed.configureTestingModule({
      imports: [MapHostComponent],
      providers: [{ provide: TILE_PROVIDER_CONFIG, useValue: fakeConfig }],
    });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(state.tileLayerCalls).toHaveLength(1);
    expect(state.tileLayerCalls[0].url).toBe(
      'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=test-key-123',
    );
    expect(state.tileLayerCalls[0].options['maxZoom']).toBe(20);
    expect(String(state.tileLayerCalls[0].options['attribution'])).toContain('MapTiler');

    const logo: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('.app-map__maptiler-logo');
    expect(logo).not.toBeNull();
    expect(logo!.getAttribute('href')).toBe('https://www.maptiler.com');
    expect(logo!.querySelector('svg')).not.toBeNull();
  });

  // Mirror of the test above with an empty key, also provided via `TestBed`,
  // so this is deterministic regardless of `environment.ts`. Does NOT
  // re-assert the console.warn call: `resolveTileSource()`'s "warn once" flag
  // is module-level (see map.component.ts) and was already flipped true by
  // the direct-call unit test at the top of this file (deliberately first,
  // for exactly this reason) — so mounting here fires no additional warning.
  // That test owns the warning assertion; this one owns the fallback URL +
  // hidden-logo wiring through the real component.
  it('falls back to the OpenStreetMap tile URL and hides the MapTiler logo when no provider key is configured', async () => {
    const fakeConfig = {
      urlTemplate: 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key={key}',
      apiKey: '',
      attribution: '<a href="https://www.maptiler.com/copyright/">&copy; MapTiler</a>',
      maxZoom: 20,
    };
    TestBed.configureTestingModule({
      imports: [MapHostComponent],
      providers: [{ provide: TILE_PROVIDER_CONFIG, useValue: fakeConfig }],
    });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    expect(state.tileLayerCalls).toHaveLength(1);
    expect(state.tileLayerCalls[0].url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(String(state.tileLayerCalls[0].options['attribution'])).toContain(
      'OpenStreetMap contributors',
    );

    const logo = fixture.nativeElement.querySelector('.app-map__maptiler-logo');
    expect(logo).toBeNull();
  });

  it('renders a static marker when a pin is set and crosshair is off', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.pin = { lat: 40.18, lng: 44.51 };
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.markerCalls).toHaveLength(1);
    expect(state.markerCalls[0].coords).toEqual([40.18, 44.51]);
  });

  it('does NOT render the marker when crosshair mode is on, even with a pin set', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.pin = { lat: 40.18, lng: 44.51 };
    fixture.componentInstance.crosshair = true;
    fixture.componentInstance.interactive = true;
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.markerCalls).toHaveLength(0);
  });

  it('emits the current centre on moveend while crosshair mode is on, including an initial emit', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.crosshair = true;
    fixture.componentInstance.interactive = true;
    fixture.detectChanges();
    await vi.runAllTimersAsync();
    fixture.detectChanges();

    // The initial emit, before any user pan.
    expect(fixture.componentInstance.received).toEqual([{ lat: 40.1776, lng: 44.5126 }]);

    // Simulate the user panning the map.
    state.fakeCenter = { lat: 40.2, lng: 44.55 };
    state.moveendHandlers.forEach((h) => h());
    fixture.detectChanges();

    expect(fixture.componentInstance.received).toEqual([
      { lat: 40.1776, lng: 44.5126 },
      { lat: 40.2, lng: 44.55 },
    ]);
  });

  it('removes the map instance on destroy', async () => {
    const fixture = await createHost();
    fixture.destroy();
    expect(state.mapRemoved).toBe(true);
  });

  // Regression for the fixed-delay `setTimeout(invalidateSize, ...)` race this
  // replaced: a `ResizeObserver` re-measures on every REAL box-size change,
  // however long it takes to arrive, instead of gambling on 60ms/320ms ever
  // landing after the container reaches its final layout.
  it('observes the map container with a ResizeObserver and calls invalidateSize() on a reported resize', async () => {
    const fixture = await createHost();

    expect(resizeObserverInstances).toHaveLength(1);
    const observer = resizeObserverInstances[0];
    const containerEl: HTMLElement = fixture.nativeElement.querySelector('.app-map__surface');
    expect(observer.observed).toEqual([containerEl]);

    expect(state.lastInvalidateSize).not.toBeNull();
    expect(state.lastInvalidateSize).not.toHaveBeenCalled();

    observer.trigger();

    expect(state.lastInvalidateSize).toHaveBeenCalledTimes(1);
  });

  it('disconnects the ResizeObserver on destroy', async () => {
    const fixture = await createHost();
    const observer = resizeObserverInstances[0];

    fixture.destroy();

    expect(observer.disconnected).toBe(true);
  });

  it('draws no circle when circleRadiusMeters is left null (the default)', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.pin = { lat: 40.18, lng: 44.51 };
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.circleCalls).toHaveLength(0);
  });

  it('draws a translucent circle of the given radius centred on the pin', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.pin = { lat: 40.18, lng: 44.51 };
    fixture.componentInstance.circleRadiusMeters = 600;
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.circleCalls).toHaveLength(1);
    expect(state.circleCalls[0].coords).toEqual([40.18, 44.51]);
    expect(state.circleCalls[0].options['radius']).toBe(600);
    // Fill/stroke must actually resolve to a colour string (jsdom returns ''
    // for an undeclared custom property, so this also exercises the fallback).
    expect(state.circleCalls[0].options['fillColor']).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('does NOT draw a circle in crosshair mode even with a radius and pin set', async () => {
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.componentInstance.pin = { lat: 40.18, lng: 44.51 };
    fixture.componentInstance.circleRadiusMeters = 600;
    fixture.componentInstance.crosshair = true;
    fixture.componentInstance.interactive = true;
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(state.circleCalls).toHaveLength(0);
  });

  it('emits mapError when the underlying Leaflet map construction throws', async () => {
    state.mapThrows = true;
    TestBed.configureTestingModule({ imports: [MapHostComponent] });
    const fixture = TestBed.createComponent(MapHostComponent);
    fixture.detectChanges();
    await vi.runAllTimersAsync();

    expect(fixture.componentInstance.errorCount).toBe(1);
  });

  it('emits mapError when every tile in the batch errors and none ever loads (dead tile host)', async () => {
    // Real Leaflet fires GridLayer's `load` once the tile queue is empty
    // whether tiles succeeded or errored — so the fixture fires `tileerror`
    // for every tile, then `load` for the settled batch, same as the real
    // sequence a dead tile host produces.
    const fixture = await createHost();

    state.tileLayerCalls[0].handlers['tileerror']?.forEach((h) => h());
    expect(fixture.componentInstance.errorCount).toBe(0);

    state.tileLayerCalls[0].handlers['load']?.forEach((h) => h());

    expect(fixture.componentInstance.errorCount).toBe(1);
  });

  it('does NOT emit mapError when at least one tile loads before the batch settles', async () => {
    const fixture = await createHost();

    state.tileLayerCalls[0].handlers['tileerror']?.forEach((h) => h());
    state.tileLayerCalls[0].handlers['tileload']?.forEach((h) => h());
    state.tileLayerCalls[0].handlers['load']?.forEach((h) => h());

    expect(fixture.componentInstance.errorCount).toBe(0);
  });

  it('does NOT emit mapError when the tile batch settles with no errors at all', async () => {
    const fixture = await createHost();

    state.tileLayerCalls[0].handlers['tileload']?.forEach((h) => h());
    state.tileLayerCalls[0].handlers['load']?.forEach((h) => h());

    expect(fixture.componentInstance.errorCount).toBe(0);
  });
});
