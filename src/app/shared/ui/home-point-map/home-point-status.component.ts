import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import type { HomePointSelection } from './home-point-map.model';

type StatusTone = 'none' | 'info' | 'warn' | 'error';

/**
 * The inline message + privacy note that sit under (mobile) or beside (desktop)
 * `app-home-point-map`. A separate component because the boards place it in a
 * different box on every surface — the sign-up dialog's body, the picker's
 * bottom sheet, the wizard gate's column — while the message itself is
 * identical everywhere.
 *
 * Exactly one message can show at a time, in this order: the blocking
 * "outside Yerevan" error, then the low-accuracy warning, then the
 * permission-denied note. The privacy line is always rendered (unless a host
 * opts out), because the boards show it BEFORE the user confirms, not after —
 * people should know about the ~100 m circle while deciding, not once it is
 * saved.
 */
@Component({
  selector: 'app-home-point-status',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './home-point-status.component.html',
  styleUrl: './home-point-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePointStatusComponent {
  readonly selection = input<HomePointSelection | null>(null);
  readonly showPrivacyNote = input<boolean>(true);
  /**
   * A server-side refusal to override the local state with. The backend raises
   * `auth.home_point_outside_yerevan` in `errorCode` (NOT as a field error), and
   * a host that has caught one shows the same red message even when the local
   * district lookup happened to disagree — the server is the authority.
   */
  readonly serverOutsideYerevan = input<boolean>(false);

  protected readonly tone = computed<StatusTone>(() => {
    if (this.serverOutsideYerevan()) return 'error';
    const s = this.selection();
    if (s === null) return 'none';
    if (s.outsideYerevan) return 'error';
    if (s.lowAccuracyMeters !== null) return 'warn';
    if (s.geoState === 'denied') return 'info';
    return 'none';
  });

  /** Interpolated into the low-accuracy caption as a plain string — a translate
   *  param cannot run a pipe of its own. */
  protected readonly accuracyParam = computed(() => ({
    meters: this.selection()?.lowAccuracyMeters ?? 0,
  }));
}
