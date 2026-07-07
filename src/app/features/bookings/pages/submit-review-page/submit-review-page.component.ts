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
import { TranslatePipe } from '@ngx-translate/core';

import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';
import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import * as BookingsActions from '../../store/bookings.actions';
import { selectMyBookingById } from '../../store/bookings.selectors';

type FlowStep = 1 | 2 | 'success';

interface SubScore {
  readonly key: string;       // i18n label key
  readonly hintKey: string;   // i18n hint key
  readonly value: ReturnType<typeof signal<number>>;
}

const RATING_LABELS = ['', 'poor', 'fair', 'good', 'great', 'excellent'] as const;

/**
 * Renter review flow: Step 1 rates the toy, Step 2 rates the owner. Each step is
 * submitted independently — the renter can rate just the toy, just the owner, or
 * both. The success screen is partial-aware.
 */
@Component({
  selector: 'app-submit-review-page',
  standalone: true,
  imports: [RouterLink, StarRatingComponent, TranslatePipe],
  templateUrl: './submit-review-page.component.html',
  styleUrl: './submit-review-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmitReviewPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReviewsApiService);

  protected readonly bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';

  protected readonly step = signal<FlowStep>(1);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** True once a toy review exists for this booking — pre-existing or submitted here. */
  protected readonly toySubmitted = signal(false);
  /** True once an owner review exists for this booking — pre-existing or submitted here. */
  protected readonly ownerSubmitted = signal(false);
  /** Gates the flow until the existing review status is known, so we resume on the right step. */
  protected readonly statusLoaded = signal(false);

  // Step 1 — toy
  protected readonly toyOverall = signal(0);
  protected readonly toyComment = signal('');
  protected readonly toySubScores: readonly SubScore[] = [
    { key: 'reviews.toy.condition', hintKey: 'reviews.toy.conditionHint', value: signal(0) },
    { key: 'reviews.toy.cleanliness', hintKey: 'reviews.toy.cleanlinessHint', value: signal(0) },
    { key: 'reviews.toy.value', hintKey: 'reviews.toy.valueHint', value: signal(0) },
    { key: 'reviews.toy.fun', hintKey: 'reviews.toy.funHint', value: signal(0) },
    { key: 'reviews.toy.description', hintKey: 'reviews.toy.descriptionHint', value: signal(0) },
  ];

  // Step 2 — owner
  protected readonly ownerComment = signal('');
  protected readonly ownerSubScores: readonly SubScore[] = [
    { key: 'reviews.owner.communication', hintKey: 'reviews.owner.communicationHint', value: signal(0) },
    { key: 'reviews.owner.pickup', hintKey: 'reviews.owner.pickupHint', value: signal(0) },
    { key: 'reviews.owner.friendliness', hintKey: 'reviews.owner.friendlinessHint', value: signal(0) },
  ];

  protected readonly booking = toSignal(
    this.store.select(selectMyBookingById(this.bookingId)),
    { initialValue: null },
  );

  protected readonly toyValid = computed(
    () => this.toyOverall() > 0 && this.toySubScores.every((s) => s.value() > 0),
  );
  protected readonly ownerValid = computed(
    () => this.ownerSubScores.every((s) => s.value() > 0),
  );

  protected readonly toyCommentCount = computed(() => this.toyComment().length);
  protected readonly ownerCommentCount = computed(() => this.ownerComment().length);

  protected readonly overallLabel = computed(() => {
    const r = this.toyOverall();
    return r > 0 ? `reviews.ratingLabel.${RATING_LABELS[r]}` : '';
  });

  ngOnInit(): void {
    if (this.booking() === null) {
      this.store.dispatch(BookingsActions.loadMyBookings());
    }
    this.loadReviewStatus();
  }

  /**
   * Resume the flow based on what the renter has already reviewed. If the toy
   * review was saved on a previous visit, we skip straight to the owner step
   * (or the success screen if both are done) instead of re-prompting for a toy
   * rating that the backend would reject as a duplicate.
   */
  private loadReviewStatus(): void {
    if (!this.bookingId) {
      this.statusLoaded.set(true);
      return;
    }
    this.api.getBookingStatus(this.bookingId).subscribe({
      next: (status) => {
        this.toySubmitted.set(status.hasToyReview);
        this.ownerSubmitted.set(status.hasOwnerReview);
        if (status.hasToyReview && status.hasOwnerReview) {
          this.step.set('success');
        } else if (status.hasToyReview) {
          this.step.set(2);
        }
        this.statusLoaded.set(true);
      },
      // On failure fall back to the default step 1 — a fresh review still works.
      error: () => this.statusLoaded.set(true),
    });
  }

  protected setToyOverall(v: number): void { this.toyOverall.set(v); }
  protected setSub(score: SubScore, v: number): void { score.value.set(v); }

  protected onToyCommentInput(e: Event): void {
    this.toyComment.set((e.target as HTMLTextAreaElement).value);
  }
  protected onOwnerCommentInput(e: Event): void {
    this.ownerComment.set((e.target as HTMLTextAreaElement).value);
  }

  /** Step 1 primary action: submit the toy review, then advance to the owner step. */
  protected submitToyAndContinue(): void {
    if (this.submitting()) return;
    // Toy already reviewed (resumed flow) — don't re-submit, just advance.
    if (this.toySubmitted()) {
      this.error.set(null);
      this.step.set(2);
      return;
    }
    if (!this.toyValid()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .submitToy({
        bookingId: this.bookingId,
        overallRating: this.toyOverall(),
        conditionRating: this.toySubScores[0].value(),
        cleanlinessRating: this.toySubScores[1].value(),
        valueForMoneyRating: this.toySubScores[2].value(),
        funPlayValueRating: this.toySubScores[3].value(),
        descriptionAccuracyRating: this.toySubScores[4].value(),
        comment: this.toyComment().trim() || null,
      })
      .subscribe({
        next: () => {
          this.toySubmitted.set(true);
          this.submitting.set(false);
          this.step.set(2);
        },
        error: (e: unknown) => {
          this.submitting.set(false);
          this.error.set(toApiErrorMessage(e));
        },
      });
  }

  /** Step 1 skip: go to the owner step without saving a toy review. */
  protected skipToy(): void {
    this.error.set(null);
    this.step.set(2);
  }

  /** Step 2 primary action: submit the owner review, then show success. */
  protected submitOwnerAndFinish(): void {
    if (this.submitting()) return;
    // Owner already reviewed (resumed flow) — don't re-submit, just finish.
    if (this.ownerSubmitted()) {
      this.error.set(null);
      this.step.set('success');
      return;
    }
    if (!this.ownerValid()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .submitOwner({
        bookingId: this.bookingId,
        communicationRating: this.ownerSubScores[0].value(),
        pickupHandoverRating: this.ownerSubScores[1].value(),
        friendlinessRating: this.ownerSubScores[2].value(),
        comment: this.ownerComment().trim() || null,
      })
      .subscribe({
        next: () => {
          this.ownerSubmitted.set(true);
          this.submitting.set(false);
          this.step.set('success');
        },
        error: (e: unknown) => {
          this.submitting.set(false);
          this.error.set(toApiErrorMessage(e));
        },
      });
  }

  /** Step 2 skip: finish without an owner review (toy review, if any, is kept). */
  protected skipOwnerAndFinish(): void {
    this.error.set(null);
    this.step.set('success');
  }

  protected goToBookings(): void {
    void this.router.navigate(['/bookings']);
  }

  protected browseToys(): void {
    void this.router.navigate(['/listings']);
  }
}
