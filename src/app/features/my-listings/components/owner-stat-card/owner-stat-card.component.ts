import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type OwnerStatDeltaTone = 'positive' | 'neutral';

/**
 * Single performance stat: icon + label, a big value, and an optional delta
 * sub-label (e.g. "+18% this week"). Purely presentational.
 */
@Component({
  selector: 'app-owner-stat-card',
  standalone: true,
  imports: [],
  templateUrl: './owner-stat-card.component.html',
  styleUrl: './owner-stat-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnerStatCardComponent {
  /** primeicons class, e.g. "pi pi-eye". */
  readonly icon = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly delta = input<string | null>(null);
  readonly deltaTone = input<OwnerStatDeltaTone>('positive');
}
