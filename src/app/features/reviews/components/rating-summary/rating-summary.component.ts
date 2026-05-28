import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';
import type { RatingSummary } from '../../models/review.model';

export type RatingSummaryVariant = 'compact' | 'full';

@Component({
  selector: 'app-rating-summary',
  standalone: true,
  imports: [StarRatingComponent, TranslatePipe],
  templateUrl: './rating-summary.component.html',
  styleUrl: './rating-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingSummaryComponent {
  readonly summary = input.required<RatingSummary>();
  readonly variant = input<RatingSummaryVariant>('compact');

  protected readonly hasRatings = computed(() => this.summary().reviewCount > 0);

  protected readonly formattedAverage = computed(() => {
    const avg = this.summary().averageRating;
    return avg > 0 ? avg.toFixed(1) : '—';
  });

  protected readonly roundedRating = computed(() =>
    Math.round(this.summary().averageRating),
  );
}
