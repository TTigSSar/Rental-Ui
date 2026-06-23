import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { StarRatingComponent } from '../../../../shared/ui/star-rating/star-rating.component';
import { toApiErrorMessage } from '../../../../api/http-error-message.util';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';

interface SubScore {
  readonly key: string;
  readonly hintKey: string;
  readonly value: ReturnType<typeof signal<number>>;
}

/** Owner reviews the renter — a single screen. */
@Component({
  selector: 'app-rate-renter-page',
  standalone: true,
  imports: [RouterLink, StarRatingComponent, TranslatePipe],
  templateUrl: './rate-renter-page.component.html',
  styleUrl: '../submit-review-page/submit-review-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateRenterPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ReviewsApiService);

  protected readonly bookingId = this.route.snapshot.paramMap.get('bookingId') ?? '';

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly done = signal(false);
  protected readonly comment = signal('');

  protected readonly subScores: readonly SubScore[] = [
    { key: 'reviews.renter.communication', hintKey: 'reviews.renter.communicationHint', value: signal(0) },
    { key: 'reviews.renter.returnedOnTime', hintKey: 'reviews.renter.returnedOnTimeHint', value: signal(0) },
    { key: 'reviews.renter.careOfToy', hintKey: 'reviews.renter.careOfToyHint', value: signal(0) },
    { key: 'reviews.renter.wouldRentAgain', hintKey: 'reviews.renter.wouldRentAgainHint', value: signal(0) },
  ];

  protected readonly valid = computed(() => this.subScores.every((s) => s.value() > 0));
  protected readonly commentCount = computed(() => this.comment().length);

  protected setSub(score: SubScore, v: number): void { score.value.set(v); }
  protected onCommentInput(e: Event): void {
    this.comment.set((e.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    if (!this.valid() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .submitRenter({
        bookingId: this.bookingId,
        communicationRating: this.subScores[0].value(),
        returnedOnTimeRating: this.subScores[1].value(),
        careOfToyRating: this.subScores[2].value(),
        wouldRentAgainRating: this.subScores[3].value(),
        comment: this.comment().trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.done.set(true);
        },
        error: (e: unknown) => {
          this.submitting.set(false);
          this.error.set(toApiErrorMessage(e));
        },
      });
  }

  protected back(): void {
    void this.router.navigate(['/bookings/requests']);
  }
}
