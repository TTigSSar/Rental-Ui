import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import type { ReviewComment } from '../../models/review.model';

interface RelativeDateI18n {
  readonly key: string;
  readonly params: Record<string, unknown>;
}

// Public comment card. overallRating is optional — shown when the API provides it.
@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [AvatarComponent, TranslatePipe],
  templateUrl: './review-card.component.html',
  styleUrl: './review-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
  readonly review = input.required<ReviewComment>();
  protected readonly stars = [1, 2, 3, 4, 5];

  protected readonly reviewerName = computed(() => {
    const r = this.review();
    return `${r.reviewerFirstName} ${r.reviewerLastName}`.trim();
  });

  protected readonly relativeDateI18n = computed((): RelativeDateI18n => {
    const createdAt = new Date(this.review().createdAt);
    const diffDays = Math.floor(
      (Date.now() - createdAt.getTime()) / 86_400_000,
    );

    if (diffDays < 1) return { key: 'reviews.relativeDate.today', params: {} };
    if (diffDays === 1) return { key: 'reviews.relativeDate.yesterday', params: {} };
    if (diffDays < 7) return { key: 'reviews.relativeDate.daysAgo', params: { count: diffDays } };
    if (diffDays < 14) return { key: 'reviews.relativeDate.weekAgo', params: {} };
    if (diffDays < 30) return { key: 'reviews.relativeDate.weeksAgo', params: { count: Math.floor(diffDays / 7) } };
    if (diffDays < 60) return { key: 'reviews.relativeDate.monthAgo', params: {} };
    if (diffDays < 365) return { key: 'reviews.relativeDate.monthsAgo', params: { count: Math.floor(diffDays / 30) } };
    const years = Math.floor(diffDays / 365);
    return years === 1
      ? { key: 'reviews.relativeDate.yearAgo', params: {} }
      : { key: 'reviews.relativeDate.yearsAgo', params: { count: years } };
  });

  protected readonly fullDate = computed(() =>
    new Date(this.review().createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  );
}
