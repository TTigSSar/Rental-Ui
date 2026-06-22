import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone = 'pending' | 'approved' | 'rejected' | 'neutral' | 'booked' | 'completed';

@Component({
  selector: 'app-ui-badge',
  standalone: true,
  template: `<span class="ui-badge" [class]="'ui-badge ui-badge--' + tone()"><span class="ui-badge__dot" aria-hidden="true"></span>{{ label() }}</span>`,
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly label = input.required<string>();
}
