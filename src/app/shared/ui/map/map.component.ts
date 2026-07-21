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
 * The OpenStreetMap attribution control is always shown, even in static mode —
 * that's an ODbL licence requirement, not decoration, so it is never disabled.
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

  readonly centerChange = output<MapLatLng>();

  private map: Leaflet.Map | null = null;
  private leaflet: typeof Leaflet | null = null;
  private markerLayer: Leaflet.Marker | null = null;
  private destroyed = false;

  constructor() {
    // Re-centre / re-zoom an already-created map when a caller changes these
    // inputs (e.g. re-opening the picker on a previously-set pin).
    effect(() => {
      const c = this.center();
      const z = this.zoom();
      this.map?.setView([c.lat, c.lng], z, { animate: false });
    });

    // Keep the static pin marker in sync with `pin`/`crosshair`.
    effect(() => {
      this.pin();
      this.crosshair();
      this.syncMarker();
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

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

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
    }

    // Leaflet measures its container's pixel size at creation time; if that
    // happens before the container has its final layout (a step just became
    // visible, a dialog is still animating open) the map renders wrong until
    // something forces a re-measure. Two delays cover both the fast case and
    // a slower dialog-open transition.
    setTimeout(() => map.invalidateSize(), 60);
    setTimeout(() => map.invalidateSize(), 320);
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

  private pinIcon(L: typeof Leaflet): Leaflet.DivIcon {
    return L.divIcon({
      className: 'app-map__marker',
      html: '<span class="app-map__marker-halo"></span><span class="app-map__marker-dot"></span>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }
}
