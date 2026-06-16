import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';

export type RatingSummaryVariant = 'compact' | 'full';

export interface RatingSummaryView {
  readonly average: number;
  readonly reviewCount: number;
  readonly hasAggregate: boolean;
}

@Component({
  selector: 'app-rating-summary',
  standalone: true,
  imports: [StarRatingComponent, TranslatePipe],
  templateUrl: './rating-summary.component.html',
  styleUrl: './rating-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingSummaryComponent {
  readonly summary = input.required<RatingSummaryView>();
  readonly variant = input<RatingSummaryVariant>('compact');

  // Numbers are only shown once the aggregate threshold is met.
  protected readonly hasRatings = computed(() => this.summary().hasAggregate);

  protected readonly formattedAverage = computed(() => {
    const avg = this.summary().average;
    return avg > 0 ? avg.toFixed(1) : '—';
  });

  protected readonly roundedRating = computed(() => Math.round(this.summary().average));
}
