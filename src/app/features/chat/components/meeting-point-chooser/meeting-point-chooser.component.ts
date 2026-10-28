import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { UiDateService } from '../../../../shared/utils/ui-date';

export type MeetingPointChoice = 'home' | 'other';

/**
 * "What do you want to share?" (ADR-053, stage-2 design). Two radio option cards, an info
 * line, "Not now" and ONE primary button whose label follows the choice. Without a saved
 * home point the home card is disabled (with a "Set home point" link to the profile) and
 * "Another place" is the only — and therefore forced — choice.
 *
 * The choice is a `model` so the host can keep "Another place" selected when the map
 * picker's Back returns here.
 */
@Component({
  selector: 'app-meeting-point-chooser',
  standalone: true,
  imports: [DialogModule, IconComponent, RouterLink, TranslatePipe],
  templateUrl: './meeting-point-chooser.component.html',
  styleUrl: './meeting-point-chooser.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The dialog shell (`.p-dialog`, header, footer) is PrimeNG's own markup, portalled to
  // <body>; the `.mp-chooser-dialog` / `mpc__*` rules must reach it unshimmed.
  encapsulation: ViewEncapsulation.None,
})
export class MeetingPointChooserComponent {
  private readonly dates = inject(UiDateService);

  readonly open = input.required<boolean>();
  readonly hasHomePoint = input.required<boolean>();
  readonly choice = model<MeetingPointChoice>('home');

  /** "Not now", Escape, or the mask. */
  readonly cancelled = output<void>();
  /** Primary button with "My home point" selected. */
  readonly shareHome = output<void>();
  /** Primary button with "Another place" selected → host opens the map picker. */
  readonly chooseOnMap = output<void>();
  /** The "Set home point" link was followed. */
  readonly setHomePoint = output<void>();

  /** The effective choice: with no home point, "Another place" regardless of the model. */
  protected readonly selected = computed<MeetingPointChoice>(() =>
    this.hasHomePoint() ? this.choice() : 'other',
  );

  /** Design: RU and HY labels are long, so the buttons stack (primary on top). */
  protected readonly stacked = computed(() => ['ru', 'hy'].includes(this.dates.lang() ?? ''));

  protected readonly primaryLabelKey = computed(() =>
    this.selected() === 'home'
      ? 'chat.meetingPoint.chooser.shareHome'
      : 'chat.meetingPoint.chooser.chooseMap',
  );

  protected select(choice: MeetingPointChoice): void {
    if (choice === 'home' && !this.hasHomePoint()) {
      return;
    }
    this.choice.set(choice);
  }

  /** Arrow keys move the selection between the enabled radios (WAI-ARIA radiogroup). */
  protected onRadioKeydown(event: KeyboardEvent, current: MeetingPointChoice): void {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      this.select(current);
      return;
    }
    const arrows = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'];
    if (!arrows.includes(event.key)) {
      return;
    }
    event.preventDefault();
    if (!this.hasHomePoint()) {
      return;
    }
    const next: MeetingPointChoice = current === 'home' ? 'other' : 'home';
    this.select(next);
    // Roving tabindex: move DOM focus along with the selection.
    const group = (event.currentTarget as HTMLElement).closest('[role="radiogroup"]');
    group?.querySelector<HTMLElement>(`[data-choice="${next}"]`)?.focus();
  }

  protected confirm(): void {
    if (this.selected() === 'home') {
      this.shareHome.emit();
    } else {
      this.chooseOnMap.emit();
    }
  }

  protected onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancelled.emit();
    }
  }
}
