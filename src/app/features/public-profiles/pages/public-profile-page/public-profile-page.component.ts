import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { distinctUntilChanged, map, of, switchMap } from 'rxjs';

import {
  RatingSummaryComponent,
  type RatingSummaryView,
} from '../../../reviews/components/rating-summary/rating-summary.component';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectOwnerReviews,
  selectOwnerReviewsError,
  selectOwnerReviewsLoading,
} from '../../../reviews/store/reviews.selectors';
import * as PublicProfilesActions from '../../store/public-profiles.actions';
import {
  selectPublicProfile,
  selectPublicProfileError,
  selectPublicProfileLoading,
} from '../../store/public-profiles.selectors';

@Component({
  selector: 'app-public-profile-page',
  standalone: true,
  imports: [
    ButtonModule,
    RatingSummaryComponent,
    ReviewCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './public-profile-page.component.html',
  styleUrl: './public-profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePageComponent {
  private readonly store = inject(Store);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  private readonly userId$ = this.route.paramMap.pipe(
    map((params) => params.get('userId')),
    distinctUntilChanged(),
  );

  private readonly userIdSignal = toSignal(this.userId$, { initialValue: null });

  protected readonly profile = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfile(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly profileLoading = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfileLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly profileError = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectPublicProfileError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  private readonly ownerSummary = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviews(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly reviews = computed(() => this.ownerSummary()?.comments ?? []);

  protected readonly reviewsLoading = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviewsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.userId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviewsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = computed((): RatingSummaryView | null => {
    const s = this.ownerSummary();
    return s ? { average: s.overallAverage, reviewCount: s.reviewCount, hasAggregate: s.hasAggregate } : null;
  });

  protected readonly displayName = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName} ${p.lastName}`.trim();
  });

  protected readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
  });

  protected readonly memberYear = computed(() => {
    const p = this.profile();
    if (!p) return '';
    return new Date(p.memberSince).getFullYear().toString();
  });

  protected readonly showSkeleton = computed(
    () => this.profileLoading() && this.profile() === null,
  );

  protected readonly showError = computed(
    () => this.profileError() !== null && this.profile() === null,
  );

  constructor() {
    effect(() => {
      const id = this.userIdSignal();
      if (id !== null && id !== '') {
        this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: id }));
        this.store.dispatch(ReviewsActions.loadOwnerReviews({ userId: id }));
      }
    });
  }

  protected goBack(): void {
    this.location.back();
  }

  protected retryLoad(): void {
    const id = this.userIdSignal();
    if (id !== null && id !== '') {
      this.store.dispatch(PublicProfilesActions.loadPublicProfile({ userId: id }));
      this.store.dispatch(ReviewsActions.loadOwnerReviews({ userId: id }));
    }
  }
}
