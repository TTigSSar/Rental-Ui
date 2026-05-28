import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import { RatingSummaryComponent } from '../../../reviews/components/rating-summary/rating-summary.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectUserReviews,
  selectUserReviewsError,
  selectUserReviewsLoading,
  selectUserSummary,
} from '../../../reviews/store/reviews.selectors';
import * as ProfileActions from '../../store/profile.actions';
import {
  selectProfile,
  selectProfileError,
  selectProfileLoading,
} from '../../store/profile.selectors';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    AsyncPipe,
    CardModule,
    MessageModule,
    RatingSummaryComponent,
    ReviewCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly store = inject(Store);

  private readonly profileId$ = this.store.select(selectProfile).pipe(
    map((p) => p?.id ?? null),
    distinctUntilChanged(),
  );

  private readonly profileIdSignal = toSignal(this.profileId$, {
    initialValue: null,
  });

  protected readonly reviews = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserReviews(id)) : of([]),
      ),
    ),
    { initialValue: [] },
  );

  protected readonly reviewsLoading = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserReviewsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserReviewsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectUserSummary(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly vm$ = combineLatest({
    profile: this.store.select(selectProfile),
    isLoading: this.store.select(selectProfileLoading),
    error: this.store.select(selectProfileError),
  }).pipe(
    map(({ profile, isLoading, error }) => ({
      profile,
      isLoading,
      error,
      showLoading: isLoading && profile === null,
      showEmpty: !isLoading && profile === null && error === null,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.profileIdSignal();
      if (id !== null) {
        this.store.dispatch(ReviewsActions.loadUserReviews({ userId: id }));
        this.store.dispatch(ReviewsActions.loadUserSummary({ userId: id }));
      }
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ProfileActions.loadProfile());
  }
}
