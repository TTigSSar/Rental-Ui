import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';

/**
 * A latitude/longitude pair. The only "coordinate" shape this component's
 * public API speaks — callers never see a Leaflet type.
 */
export interface MapLatLng {
  lat: number;
  lng: number;
}

const LEAFLET_CSS_ID = 'app-map-leaflet-css';
/**
 * The map + its stylesheet come from `node_modules/leaflet/dist` and are copied
 * to this path at build time (see the `assets` entry in `angular.json`) rather
 * than shipped in the JS bundle — see `ensureLeafletCss()`.
 */
const LEAFLET_CSS_HREF = 'leaflet/leaflet.css';

/** Inserts Leaflet's stylesheet on first use only — never on app boot. */
function ensureLeafletCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_HREF;
  document.head.appendChild(link);
}

/**
 * Shared Leaflet map wrapper — the ONLY file in the codebase allowed to import
 * `leaflet`. Everything else (the wizard's location picker today; the P1-8
 * read-only listing-detail map next) talks to this through inputs/outputs only,
 * so Leaflet types never leak across the boundary.
 *
 * Leaflet itself is loaded with a dynamic `import('leaflet')` inside
 * `ngAfterViewInit`, and its CSS is injected lazily the same way — neither adds
 * to the app's main bundle. Two `invalidateSize()` calls (60ms / 320ms after
 * init) work around Leaflet measuring a container before it has its final
 * layout size (e.g. right after a dialog opens or a wizard step becomes
 * visible).
 *
 * Two display modes:
 * - `interactive=false` (default): a frozen thumbnail — no pan/zoom/drag. Used
 *   for the small "here's your pin" preview and (P1-8) the detail-page map.
 * - `interactive=true`: fully pannable/zoomable.
 *   - with `pin` set: shows a static marker at that coordinate.
 *   - with `crosshair=true`: hides the marker and instead overlays a fixed
 *     crosshair pin at the container's centre — the MAP pans under it. This is
 *     the full-screen location-picker's mechanism (dragging a marker is much
 *     less reliable on touch). `centerChange` emits the map's centre whenever
 *     it settles.
 *
 * `circleRadiusMeters` (P1-8): when set alongside `pin` (and `crosshair` is
 * off), draws a translucent circle of that radius centred on the pin — used by
 * the detail-page map to show the honest uncertainty radius of a fuzzed
 * (geohash-6-snapped) coordinate. Its stroke/fill colour is read from the
 * `--ui-color-primary` CSS custom property on this component's own host at
 * draw time (falling back to the design token's literal value if that ever
 * fails) rather than hardcoded, so it is impossible for Leaflet's SVG renderer
 * — which resolves colour strings once, on the DOM it owns outside Angular's
 * style encapsulation — to drift from the app's actual token.
 *
 * The OpenStreetMap attribution control is always shown, even in static mode —
 * that's an ODbL licence requirement, not decoration, so it is never disabled.
 *
 * `mapError` fires once if the map fails to come up at all: the dynamic
 * `import('leaflet')` rejects, `L.map()`/tile-layer setup throws, or every
 * tile in the initial viewport fails (dead tile host / offline) — see the
 * `tileload`/`tileerror`/`load` wiring in `init()`. Note `GridLayer`'s own
 * `load` event fires once the tile-loading queue is empty, i.e. once every
 * requested tile has *settled* — NOT once every tile has *succeeded*; it
 * fires the same way whether tiles loaded or errored. So "the map failed" is
 * decided by combining it with per-tile `tileload`/`tileerror` counts (at
 * least one error, and not a single success) rather than trusting `load`
 * alone. Callers must treat `mapError` as "no map" and fall back to a
 * text-only display — this component never renders an empty grey box on
 * failure, but it also doesn't retry on its own.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly containerRef =
    viewChild.required<ElementRef<HTMLDivElement>>('container');

  readonly center = input.required<MapLatLng>();
  readonly zoom = input<number>(13);
  readonly pin = input<MapLatLng | null>(null);
  readonly height = input<string>('280px');
  readonly interactive = input<boolean>(false);
  readonly crosshair = input<boolean>(false);
  /** Radius (metres) of the translucent uncertainty circle drawn at `pin`. `null` (default) draws no circle. */
  readonly circleRadiusMeters = input<number | null>(null);

  readonly centerChange = output<MapLatLng>();
  readonly mapError = output<void>();

  private map: Leaflet.Map | null = null;
  private leaflet: typeof Leaflet | null = null;
  private markerLayer: Leaflet.Marker | null = null;
  private circleLayer: Leaflet.Circle | null = null;
  private destroyed = false;
  private anyTileLoaded = false;
  private anyTileErrored = false;
  private errorReported = false;

  constructor() {
    // Re-centre / re-zoom an already-created map when a caller changes these
    // inputs (e.g. re-opening the picker on a previously-set pin).
    effect(() => {
      const c = this.center();
      const z = this.zoom();
      this.map?.setView([c.lat, c.lng], z, { animate: false });
    });

    // Keep the static pin marker + uncertainty circle in sync with `pin`/
    // `crosshair`/`circleRadiusMeters`.
    effect(() => {
      this.pin();
      this.crosshair();
      this.circleRadiusMeters();
      this.syncMarker();
      this.syncCircle();
    });
  }

  ngAfterViewInit(): void {
    void this.init();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
    this.map = null;
  }

  private async init(): Promise<void> {
    try {
      ensureLeafletCss();
      const L = await import('leaflet');
      // The component may have been destroyed (e.g. dialog closed) while the
      // dynamic import was in flight.
      if (this.destroyed) return;
      this.leaflet = L;

      const interactive = this.interactive();
      const c = this.center();
      const map = L.map(this.containerRef().nativeElement, {
        center: [c.lat, c.lng],
        zoom: this.zoom(),
        zoomControl: interactive,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        // Always on — required attribution for OpenStreetMap tiles (ODbL), not
        // gated by interactivity.
        attributionControl: true,
      });
      this.map = map;

      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Detect a dead tile server. `tileload`/`tileerror` fire per tile;
      // `load` fires once the whole batch has settled either way (see the
      // class doc comment) — that's the point at which "at least one error,
      // and not a single success" means every tile in view failed, i.e. the
      // tile host itself is unreachable rather than one stray 404.
      tileLayer.on('tileload', () => {
        this.anyTileLoaded = true;
      });
      tileLayer.on('tileerror', () => {
        this.anyTileErrored = true;
      });
      tileLayer.on('load', () => {
        if (this.anyTileErrored && !this.anyTileLoaded && !this.destroyed) {
          this.reportError();
        }
      });

      if (this.crosshair()) {
        const emitCenter = () => {
          const center = map.getCenter();
          this.centerChange.emit({ lat: center.lat, lng: center.lng });
        };
        map.on('moveend', emitCenter);
        // Report the starting centre immediately — a confirm without any pan
        // still needs a coordinate to submit.
        emitCenter();
      } else {
        this.syncMarker();
        this.syncCircle();
      }

      // Leaflet measures its container's pixel size at creation time; if that
      // happens before the container has its final layout (a step just became
      // visible, a dialog is still animating open) the map renders wrong until
      // something forces a re-measure. Two delays cover both the fast case and
      // a slower dialog-open transition.
      setTimeout(() => map.invalidateSize(), 60);
      setTimeout(() => map.invalidateSize(), 320);
    } catch {
      // `import('leaflet')` rejected, or map/tile-layer setup threw
      // synchronously (e.g. no canvas/SVG support). Report and bail — no
      // partial map is left behind for the caller to render around.
      this.reportError();
    }
  }

  private reportError(): void {
    if (this.errorReported) return;
    this.errorReported = true;
    this.mapError.emit();
  }

  private syncMarker(): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    if (this.markerLayer) {
      map.removeLayer(this.markerLayer);
      this.markerLayer = null;
    }

    const p = this.pin();
    // The crosshair overlay IS the pin in that mode — never show both.
    if (p && !this.crosshair()) {
      this.markerLayer = L.marker([p.lat, p.lng], {
        icon: this.pinIcon(L),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    }
  }

  private syncCircle(): void {
    const L = this.leaflet;
    const map = this.map;
    if (!L || !map) return;

    if (this.circleLayer) {
      map.removeLayer(this.circleLayer);
      this.circleLayer = null;
    }

    const p = this.pin();
    const radius = this.circleRadiusMeters();
    // Same reasoning as the marker: the crosshair mode has no fixed pin to
    // circle, so never draw one there.
    if (p && radius !== null && radius > 0 && !this.crosshair()) {
      const primary = this.readPrimaryColor();
      this.circleLayer = L.circle([p.lat, p.lng], {
        radius,
        color: primary,
        weight: 1.5,
        opacity: 0.55,
        fillColor: primary,
        fillOpacity: 0.16,
        interactive: false,
      }).addTo(map);
    }
  }

  /** Reads the live `--ui-color-primary` value off this component's own host
   *  so Leaflet's SVG renderer (which resolves colour strings once, outside
   *  Angular's style encapsulation) always matches the app's actual token
   *  instead of a value baked in at build time. */
  private readPrimaryColor(): string {
    const FALLBACK = '#ff6008';
    const el = this.containerRef()?.nativeElement;
    if (!el || typeof getComputedStyle !== 'function') return FALLBACK;
    const value = getComputedStyle(el).getPropertyValue('--ui-color-primary').trim();
    return value || FALLBACK;
  }

  private pinIcon(L: typeof Leaflet): Leaflet.DivIcon {
    return L.divIcon({
      className: 'app-map__marker',
      html: '<span class="app-map__marker-halo"></span><span class="app-map__marker-dot"></span>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
}
