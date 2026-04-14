import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type BadgeTone = 'pending' | 'approved' | 'rejected' | 'neutral';

@Component({
  selector: 'app-ui-badge',
  standalone: true,
  template: `<span class="ui-badge" [class]="'ui-badge ui-badge--' + tone()">{{ label() }}</span>`,
  styleUrl: './badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('neutral');
  readonly label = input.required<string>();
}
