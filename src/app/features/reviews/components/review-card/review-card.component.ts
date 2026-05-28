import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';
import type { Review } from '../../models/review.model';

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [AvatarComponent, StarRatingComponent],
  templateUrl: './review-card.component.html',
  styleUrl: './review-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
  readonly review = input.required<Review>();

  protected readonly reviewerName = computed(() => {
    const r = this.review();
    return `${r.reviewerFirstName} ${r.reviewerLastName}`.trim();
  });

  protected readonly relativeDate = computed(() => {
    const createdAt = new Date(this.review().createdAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000);

    if (diffDays < 1) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return '1 month ago';
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  });

  protected readonly fullDate = computed(() =>
    new Date(this.review().createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  );
}
