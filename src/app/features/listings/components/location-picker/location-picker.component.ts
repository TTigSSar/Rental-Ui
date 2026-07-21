import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';

import { MapComponent } from '../../../../shared/ui/map/map.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';

/** Republic Square, Yerevan — the wizard's default pin location. */
export const YEREVAN_CENTER: MapLatLng = { lat: 40.1776, lng: 44.5126 };
/** City-level framing for the initial view. */
export const DEFAULT_PICKER_ZOOM = 13;

/**
 * Full-screen "drop a pin" picker used by the create-listing wizard's Step 3.
 *
 * Rather than a draggable marker (fiddly on touch), the map itself pans under a
 * fixed centre crosshair (`app-map`'s `crosshair` mode) — confirming just reads
 * off whatever coordinate is currently under the crosshair.
 *
 * A11y: built on PrimeNG's `p-dialog` (`modal` + default `focusTrap`/
 * `closeOnEscape`/`focusOnShow`), which already gives this a proper
 * `role="dialog"`/`aria-modal`/`aria-labelledby`, a keyboard focus trap, and
 * Escape-to-close — the same primitive `auth-dialog` already uses elsewhere in
 * this codebase. Returning focus to the trigger that opened the picker is the
 * caller's job (it owns that button), via the `confirmed`/`cancelled` outputs.
 */
@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [DialogModule, MapComponent, TranslatePipe],
  templateUrl: './location-picker.component.html',
  styleUrl: './location-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `appendTo="body"` portals the dialog outside this component's own DOM
  // subtree, so Angular's emulated `_ngcontent` scoping attribute never reaches
  // it — same reasoning as `auth-dialog.component.ts`.
  encapsulation: ViewEncapsulation.None,
})
export class LocationPickerComponent {
  readonly open = input.required<boolean>();
  /** Re-centres on the already-picked pin when re-opening; else Yerevan. */
  readonly initialCenter = input<MapLatLng>(YEREVAN_CENTER);
  readonly initialZoom = input<number>(DEFAULT_PICKER_ZOOM);

  readonly confirmed = output<MapLatLng>();
  readonly cancelled = output<void>();

  /**
   * The coordinate currently under the crosshair — updated as the map pans,
   * read only by `confirm()`. Deliberately NEVER fed back into `app-map`'s
   * `[center]` input (the template binds that to `initialCenter()` instead):
   * doing so closed a feedback loop that hit Angular's NG0103 ("infinite
   * change detection") — pan → `centerChange` → `currentCenter.set()` →
   * `[center]` changes → `app-map`'s own effect calls `setView()` → Leaflet
   * fires `moveend` again → repeat. `initialCenter` only changes when the
   * picker (re)opens, so binding to it is a single, one-shot `setView()` with
   * no way to re-trigger itself.
   */
  protected readonly currentCenter = signal<MapLatLng>(YEREVAN_CENTER);

  constructor() {
    // Reset the crosshair's starting point every time the picker (re-)opens.
    effect(() => {
      if (this.open()) {
        this.currentCenter.set(this.initialCenter());
      }
    });
  }

  protected onCenterChange(center: MapLatLng): void {
    this.currentCenter.set(center);
  }

  /** Wired to `p-dialog`'s `(visibleChange)` — fires on Escape, the header's
   *  close button, or a future mask click; all three mean "cancel". */
  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancelled.emit();
    }
  }

  protected confirm(): void {
    this.confirmed.emit(this.currentCenter());
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
