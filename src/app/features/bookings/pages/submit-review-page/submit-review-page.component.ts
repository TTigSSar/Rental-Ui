import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectIsSubmitting,
  selectSubmissionError,
  selectSubmittedReview,
} from '../../../reviews/store/reviews.selectors';
import * as BookingsActions from '../../store/bookings.actions';
import { selectMyBookingById } from '../../store/bookings.selectors';

@Component({
  selector: 'app-submit-review-page',
  standalone: true,
  imports: [DatePipe, RouterLink, StarRatingComponent, TranslatePipe],
  templateUrl: './submit-review-page.component.html',
  styleUrl: './submit-review-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmitReviewPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  protected readonly bookingId =
    this.route.snapshot.paramMap.get('bookingId') ?? '';

  protected readonly selectedRating = signal<number>(0);
  protected readonly comment = signal<string>('');

  protected readonly booking = toSignal(
    this.store.select(selectMyBookingById(this.bookingId)),
    { initialValue: null },
  );
  protected readonly isSubmitting = toSignal(
    this.store.select(selectIsSubmitting),
    { initialValue: false },
  );
  protected readonly submittedReview = toSignal(
    this.store.select(selectSubmittedReview),
    { initialValue: null },
  );
  protected readonly submissionError = toSignal(
    this.store.select(selectSubmissionError),
    { initialValue: null },
  );

  protected readonly isSuccess = computed(() => this.submittedReview() !== null);
  protected readonly canSubmit = computed(
    () => this.selectedRating() > 0 && !this.isSubmitting(),
  );
  protected readonly charCount = computed(() => this.comment().length);

  protected readonly ratingLabel = computed(() => {
    const r = this.selectedRating();
    if (r === 0) return '';
    return this.translate.instant(`reviews.submit.ratingLabel_${r}`) as string;
  });

  ngOnInit(): void {
    this.store.dispatch(ReviewsActions.resetSubmission());
    // Populate booking context if we arrived via direct URL (store is empty)
    if (this.booking() === null) {
      this.store.dispatch(BookingsActions.loadMyBookings());
    }
  }

  protected onRatingChange(rating: number): void {
    this.selectedRating.set(rating);
  }

  protected onCommentInput(event: Event): void {
    this.comment.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSubmit(): void {
    const rating = this.selectedRating();
    if (!rating || !this.bookingId) return;
    this.store.dispatch(
      ReviewsActions.submitReview({
        request: {
          bookingId: this.bookingId,
          rating,
          comment: this.comment().trim() || null,
        },
      }),
    );
  }

  protected onSkip(): void {
    void this.router.navigate(['/bookings']);
  }

  protected onGoToBookings(): void {
    this.store.dispatch(ReviewsActions.resetSubmission());
    void this.router.navigate(['/bookings']);
  }
}
