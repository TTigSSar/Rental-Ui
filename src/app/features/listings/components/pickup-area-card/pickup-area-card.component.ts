import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { selectHomePoint } from '../../../auth/store/auth.selectors';
import { LanguageService } from '../../../../shared/services/language.service';
import { MapComponent } from '../../../../shared/ui/map/map.component';
import type { MapLatLng } from '../../../../shared/ui/map/map.component';
import { APPROXIMATE_AREA_RADIUS_METERS } from '../../models/approximate-area.const';
import { districtDisplayName } from '../../models/district-ui.util';

/**
 * Read-only "Pickup area" card — step 3 of the add-a-toy wizard and the
 * Location & delivery section of the edit-toy page.
 *
 * A listing has no location of its own any more (home-point model): it is shown
 * from its owner's single home point, so this card can only ever REPORT that
 * point, never edit it per listing. It draws exactly what a renter sees — the
 * approximate circle around the PUBLIC coordinate, no exact pin — which is also
 * why it binds `publicLatitude`/`publicLongitude` and falls back to the exact
 * pair only when the backend has not derived the public one yet. Rendering the
 * exact pin here would show the owner something different from what is
 * published and quietly normalise putting the exact point on screen (ADR-008).
 *
 * It never blocks anything: it has no validation, no form control and no
 * required state, so an edit-mode Save can never be gated on it (M-038).
 */
@Component({
  selector: 'app-pickup-area-card',
  standalone: true,
  imports: [MapComponent, TranslatePipe],
  templateUrl: './pickup-area-card.component.html',
  styleUrl: './pickup-area-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickupAreaCardComponent {
  private readonly store = inject(Store);
  private readonly languageService = inject(LanguageService);

  /** Map height — the boards use a shorter block on mobile than on desktop. */
  readonly mapHeight = input<string>('130px');

  /**
   * "Change home point". Deliberately an OUTPUT, not a `routerLink` to the
   * profile: the boards linked out to the profile card, but neither the wizard
   * nor the edit page saves a draft, so navigating away silently discards a
   * half-filled form. The host opens the picker in place instead.
   */
  readonly changeRequested = output<void>();

  private readonly changeButton = viewChild<ElementRef<HTMLButtonElement>>('changeButton');

  /**
   * Moves focus back onto "Change home point". The host opens a modal picker
   * from this card, and returning focus to the control that opened it when the
   * modal closes is the host's job (it owns the open/close), but only this
   * component owns the button — so it exposes the move rather than the node.
   */
  focusChangeButton(): void {
    this.changeButton()?.nativeElement.focus();
  }

  protected readonly homePoint = this.store.selectSignal(selectHomePoint);

  protected readonly approximateRadiusMeters = APPROXIMATE_AREA_RADIUS_METERS;

  /** The PUBLIC pair — what renters see. Falls back to the exact pair only
   *  while the backend has not derived the public one yet (a fresh save), so
   *  the card is never blank for a point that exists. */
  protected readonly publicPin = computed<MapLatLng | null>(() => {
    const point = this.homePoint();
    if (point === null) return null;
    const lat = point.publicLatitude ?? point.latitude;
    const lng = point.publicLongitude ?? point.longitude;
    return { lat, lng };
  });

  protected readonly districtLabel = computed<string>(() => {
    const district = this.homePoint()?.district ?? null;
    return district ? districtDisplayName(district, this.languageService.current().code) : '';
  });
}
