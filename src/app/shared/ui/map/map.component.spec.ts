import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MapComponent, resolveTileSource } from './map.component';
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
}));

function makeFakeMap(options: Record<string, unknown>) {
  state.mapOptions = options;
  return {
    setView: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'moveend') state.moveendHandlers.push(handler);
    }),
    getCenter: vi.fn(() => state.fakeCenter),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn((layer: unknown) => state.removedLayers.push(layer)),
    remove: vi.fn(() => {
      state.mapRemoved = true;
    }),
  };
}

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

  it('adds the OpenStreetMap tile layer with the required attribution and maxZoom', async () => {
    await createHost();

    expect(state.tileLayerCalls).toHaveLength(1);
    expect(state.tileLayerCalls[0].url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(state.tileLayerCalls[0].options['maxZoom']).toBe(19);
    expect(String(state.tileLayerCalls[0].options['attribution'])).toContain('OpenStreetMap');
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
