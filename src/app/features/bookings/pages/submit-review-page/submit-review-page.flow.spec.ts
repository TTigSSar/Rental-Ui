import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';

import { makeReviewStatus } from '../../../../../testing/fixtures';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import { SubmitReviewPageComponent } from './submit-review-page.component';

interface Internals {
  step(): 1 | 2 | 'success';
  submitting(): boolean;
  error(): string | null;
  toyValid(): boolean;
  ownerValid(): boolean;
  toyOverall: { set(v: number): void };
  toyComment: { set(v: string): void };
  toySubScores: readonly { value: { set(v: number): void } }[];
  ownerSubScores: readonly { value: { set(v: number): void } }[];
  submitToyAndContinue(): void;
  submitOwnerAndFinish(): void;
  skipToy(): void;
}

function createComponent(api: Partial<ReviewsApiService>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: ReviewsApiService, useValue: api },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: { get: () => 'booking-1' } } },
      },
    ],
  });
  const fixture = TestBed.createComponent(SubmitReviewPageComponent);
  return fixture.componentInstance as unknown as Internals;
}

function fillToy(c: Internals): void {
  c.toyOverall.set(5);
  c.toySubScores.forEach((s) => s.value.set(4));
}

describe('SubmitReviewPageComponent flow', () => {
  describe('validation', () => {
    it('requires an overall score and every toy sub-score', () => {
      const c = createComponent({ submitToy: () => of(makeReviewStatus()) });
      expect(c.toyValid()).toBe(false);
      c.toyOverall.set(5);
      expect(c.toyValid()).toBe(false); // sub-scores still zero
      c.toySubScores.forEach((s) => s.value.set(3));
      expect(c.toyValid()).toBe(true);
    });

    it('requires every owner sub-score', () => {
      const c = createComponent({ submitOwner: () => of(makeReviewStatus()) });
      expect(c.ownerValid()).toBe(false);
      c.ownerSubScores.forEach((s) => s.value.set(5));
      expect(c.ownerValid()).toBe(true);
    });
  });

  describe('toy submission', () => {
    it('submits and advances to the owner step on success', () => {
      const submitToy = vi.fn().mockReturnValue(of(makeReviewStatus()));
      const c = createComponent({ submitToy });
      fillToy(c);

      c.submitToyAndContinue();

      expect(submitToy).toHaveBeenCalledOnce();
      expect(c.step()).toBe(2);
      expect(c.submitting()).toBe(false);
    });

    it('does nothing while invalid', () => {
      const submitToy = vi.fn().mockReturnValue(of(makeReviewStatus()));
      const c = createComponent({ submitToy });
      c.submitToyAndContinue();
      expect(submitToy).not.toHaveBeenCalled();
      expect(c.step()).toBe(1);
    });

    it('surfaces a normalized error and stays on step 1 on failure', () => {
      const submitToy = vi.fn().mockReturnValue(throwError(() => new Error('server down')));
      const c = createComponent({ submitToy });
      fillToy(c);

      c.submitToyAndContinue();

      expect(c.error()).toBe('server down');
      expect(c.submitting()).toBe(false);
      expect(c.step()).toBe(1);
    });
  });

  describe('partial flow', () => {
    it('lets the renter skip the toy review and rate only the owner', () => {
      const submitOwner = vi.fn().mockReturnValue(of(makeReviewStatus()));
      const c = createComponent({ submitOwner });

      c.skipToy();
      expect(c.step()).toBe(2);

      c.ownerSubScores.forEach((s) => s.value.set(4));
      c.submitOwnerAndFinish();

      expect(submitOwner).toHaveBeenCalledOnce();
      expect(c.step()).toBe('success');
    });
  });
});
