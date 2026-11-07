import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { ReviewComment } from '../../models/review.model';
import { ReviewCardComponent } from './review-card.component';

function render(overrides: Partial<ReviewComment>): HTMLElement {
  TestBed.configureTestingModule({
    imports: [ReviewCardComponent, TranslateModule.forRoot()],
  });
  const fixture = TestBed.createComponent(ReviewCardComponent);
  fixture.componentRef.setInput('review', {
    id: 'r1',
    reviewerFirstName: 'Anna',
    reviewerLastName: 'K',
    reviewerAvatarUrl: null,
    reviewerIsDeleted: false,
    comment: 'Great toy',
    rentedDays: 2,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  } satisfies ReviewComment);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ReviewCardComponent — deleted reviewer (ADR-056)', () => {
  it('shows the shared avatar and "Deleted user", keeping the review text', () => {
    const host = render({
      reviewerFirstName: '',
      reviewerLastName: '',
      reviewerIsDeleted: true,
    });
    expect(host.querySelector('app-deleted-user-avatar')).not.toBeNull();
    expect(host.querySelector('.review-card__name')?.tagName).toBe('APP-DELETED-USER-NAME');
    expect(host.textContent).toContain('Great toy');
  });

  it('shows the reviewer name for a live reviewer', () => {
    const host = render({});
    expect(host.querySelector('app-deleted-user-avatar')).toBeNull();
    expect(host.querySelector('.review-card__name')?.textContent?.trim()).toBe('Anna K');
  });
});
