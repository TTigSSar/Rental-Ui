import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { MapComponent } from './map.component';
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
  tileLayerCalls: [] as { url: string; options: Record<string, unknown> }[],
  markerCalls: [] as { coords: [number, number]; options: Record<string, unknown> }[],
  removedLayers: [] as unknown[],
  moveendHandlers: [] as (() => void)[],
  fakeCenter: { lat: 40.1776, lng: 44.5126 },
  mapRemoved: false,
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

vi.mock('leaflet', () => ({
  map: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => makeFakeMap(options)),
  tileLayer: vi.fn((url: string, options: Record<string, unknown>) => {
    state.tileLayerCalls.push({ url, options });
    return { addTo: vi.fn() };
  }),
  marker: vi.fn((coords: [number, number], options: Record<string, unknown>) => {
    state.markerCalls.push({ coords, options });
    return { addTo: vi.fn() };
  }),
  divIcon: vi.fn((options: Record<string, unknown>) => ({ __divIcon: true, ...options })),
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
      (centerChange)="onCenterChange($event)"
    />
  `,
})
class MapHostComponent {
  center: MapLatLng = { lat: 40.1776, lng: 44.5126 };
  zoom = 13;
  pin: MapLatLng | null = null;
  interactive = false;
  crosshair = false;
  received: MapLatLng[] = [];
  onCenterChange(c: MapLatLng): void {
    this.received.push(c);
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
    state.removedLayers = [];
    state.moveendHandlers = [];
    state.fakeCenter = { lat: 40.1776, lng: 44.5126 };
    state.mapRemoved = false;
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
