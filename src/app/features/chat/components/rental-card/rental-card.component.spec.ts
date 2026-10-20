import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { type Observable, NEVER, Subject, of, throwError } from 'rxjs';

import * as BookingsActions from '../../../bookings/store/bookings.actions';
import type { BookingReviewStatus } from '../../../reviews/models/review.model';
import { ReviewsApiService } from '../../../reviews/services/reviews-api.service';
import type { ChatConversationDetails } from '../../models/chat.model';
import { RentalCardComponent } from './rental-card.component';

function conversation(overrides: Partial<ChatConversationDetails> = {}): ChatConversationDetails {
  return {
    id: 'c1',
    kind: 'booking',
    bookingId: 'b1',
    counterpartId: 'u2',
    counterpartName: 'Anna',
    counterpartAvatarUrl: null,
    counterpartVerified: false,
    toyTitle: 'Wooden train',
    toyImageUrl: null,
    status: 'requested',
    bookingDates: '2026-10-25 – 2026-10-29',
    bookingPrice: 14000,
    isClosed: false,
    bookingStatus: 'requested',
    listingId: null,
    renterNote: null,
    viewerRole: 'owner',
    turn: 'owner',
    deadlineAt: '2026-10-21T10:05:00Z',
    startDate: '2026-10-25',
    endDate: '2026-10-29',
    rentalDays: 4,
    rejectionReason: null,
    messages: [],
    ...overrides,
  };
}

function reviewStatus(overrides: Partial<BookingReviewStatus> = {}): BookingReviewStatus {
  return {
    bookingId: 'b1',
    role: 'owner',
    isCompleted: true,
    canReviewToy: false,
    canReviewOwner: false,
    canReviewRenter: true,
    hasToyReview: false,
    hasOwnerReview: false,
    hasRenterReview: false,
    ...overrides,
  };
}

function setup(
  c: ChatConversationDetails,
  review$: Observable<BookingReviewStatus> = of(reviewStatus()),
) {
  const actions$ = new Subject<unknown>();
  TestBed.configureTestingModule({
    imports: [RentalCardComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore(),
      { provide: Actions, useValue: actions$ },
      { provide: ReviewsApiService, useValue: { getBookingStatus: vi.fn(() => review$) } },
    ],
  });
  const store = TestBed.inject(MockStore);
  const dispatch = vi.spyOn(store, 'dispatch');
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RentalCardComponent);
  fixture.componentRef.setInput('conversation', c);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  return { fixture, host, dispatch, navigate, actions$ };
}

function buttons(host: HTMLElement): HTMLButtonElement[] {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('.rental-btn'));
}

describe('RentalCardComponent', () => {
  it('renders nothing when the booking status is unknown', () => {
    const { host } = setup(conversation({ bookingStatus: null }));
    expect(host.querySelector('.rental-card')).toBeNull();
  });

  describe('top bar (turn === viewerRole)', () => {
    it("shows when it is the viewer's turn", () => {
      const { host } = setup(conversation({ viewerRole: 'owner', turn: 'owner' }));
      expect(host.querySelector('.rental-card__bar')).not.toBeNull();
    });

    it("is absent when it is the other party's turn", () => {
      const { host } = setup(conversation({ viewerRole: 'renter', turn: 'owner' }));
      expect(host.querySelector('.rental-card__bar')).toBeNull();
    });

    it('is absent when nobody is up', () => {
      const { host } = setup(
        conversation({ bookingStatus: 'active', viewerRole: 'owner', turn: 'none' }),
      );
      expect(host.querySelector('.rental-card__bar')).toBeNull();
    });
  });

  describe('owner, requested', () => {
    it('Accept dispatches approveBookingRequest and disables the buttons while in flight', () => {
      const { fixture, host, dispatch } = setup(conversation());
      buttons(host)[0].click();
      fixture.detectChanges();
      expect(dispatch).toHaveBeenCalledWith(
        BookingsActions.approveBookingRequest({ bookingId: 'b1' }),
      );
      expect(buttons(host).every((b) => b.disabled)).toBe(true);
    });

    it('Decline opens the reason dialog and dispatches rejectBookingRequest on confirm', () => {
      const { fixture, dispatch } = setup(conversation());
      const host = fixture.nativeElement as HTMLElement;
      buttons(host)[1].click();
      fixture.detectChanges();
      expect(dispatch).not.toHaveBeenCalled();

      const comp = fixture.componentInstance as unknown as {
        rejectDialogVisible: () => boolean;
        confirmReject: (r: { reason: string | null }) => void;
      };
      expect(comp.rejectDialogVisible()).toBe(true);

      comp.confirmReject({ reason: 'not_a_fit' });
      expect(dispatch).toHaveBeenCalledWith(
        BookingsActions.rejectBookingRequest({ bookingId: 'b1', reason: 'not_a_fit' }),
      );
      expect(comp.rejectDialogVisible()).toBe(false);
    });
  });

  it('owner, approved: "I handed it over" dispatches markActive', () => {
    const { host, dispatch } = setup(conversation({ bookingStatus: 'approved', turn: 'owner' }));
    buttons(host)[0].click();
    expect(dispatch).toHaveBeenCalledWith(BookingsActions.markActive({ bookingId: 'b1' }));
  });

  it('owner, active: "Received back" dispatches completeBooking', () => {
    const { host, dispatch } = setup(conversation({ bookingStatus: 'active', turn: 'none' }));
    buttons(host)[0].click();
    expect(dispatch).toHaveBeenCalledWith(BookingsActions.completeBooking({ bookingId: 'b1' }));
  });

  it('renter, requested: no buttons (withdraw lives in the menu)', () => {
    const { host } = setup(conversation({ viewerRole: 'renter', turn: 'owner' }));
    expect(buttons(host)).toHaveLength(0);
    expect(host.querySelector('.rental-badge--wait')).not.toBeNull();
  });

  it('completed: "Leave a review" navigates to the role-specific review route', () => {
    const owner = setup(conversation({ bookingStatus: 'completed', turn: 'none' }));
    buttons(owner.host)[0].click();
    expect(owner.navigate).toHaveBeenCalledWith(['/bookings', 'b1', 'review', 'renter']);
    TestBed.resetTestingModule();

    const renter = setup(
      conversation({ bookingStatus: 'closed', viewerRole: 'renter', turn: 'none' }),
    );
    buttons(renter.host)[0].click();
    expect(renter.navigate).toHaveBeenCalledWith(['/bookings', 'b1', 'review']);
  });

  it('not_happened (renter): shows the owner\'s free-text reason and "Find similar toys"', () => {
    const { host, navigate } = setup(
      conversation({
        bookingStatus: 'not_happened',
        viewerRole: 'renter',
        turn: 'none',
        rejectionReason: 'Sorry, it is being repaired',
      }),
    );
    expect(host.querySelector('.rental-badge--void')).not.toBeNull();
    expect(host.querySelector('.rental-card__quote-text')?.textContent).toContain(
      'Sorry, it is being repaired',
    );
    buttons(host)[0].click();
    expect(navigate).toHaveBeenCalledWith(['/listings']);
  });

  it('shows the failure message from the errorCode mapper and re-enables the buttons', () => {
    const { fixture, host, actions$ } = setup(conversation());
    buttons(host)[0].click();
    actions$.next(
      BookingsActions.approveBookingRequestFailure({ bookingId: 'b1', error: 'Already decided' }),
    );
    fixture.detectChanges();
    expect(host.querySelector('.rental-card__error')?.textContent).toContain('Already decided');
    expect(buttons(host).every((b) => !b.disabled)).toBe(true);
  });

  describe('⋯ menu', () => {
    function menuLabels(host: HTMLElement, fixture: { detectChanges(): void }): string[] {
      host.querySelector<HTMLButtonElement>('.rental-card__more')!.click();
      fixture.detectChanges();
      return Array.from(document.body.querySelectorAll('.p-menu .p-menu-item-label')).map(
        (e) => e.textContent?.trim() ?? '',
      );
    }

    it('has "Show toy listing" only when the conversation has a listingId', () => {
      const withListing = setup(
        conversation({ viewerRole: 'renter', turn: 'owner', listingId: 'l1' }),
      );
      expect(menuLabels(withListing.host, withListing.fixture)).toContain(
        'chat.rental.menu.viewListing',
      );
      TestBed.resetTestingModule();

      const without = setup(conversation({ viewerRole: 'renter', turn: 'owner', listingId: null }));
      const labels = menuLabels(without.host, without.fixture);
      expect(labels).not.toContain('chat.rental.menu.viewListing');
      expect(labels).toContain('chat.rental.menu.viewBooking');
    });

    it('"Show toy listing" opens the public listing route', () => {
      const { fixture, host, navigate } = setup(
        conversation({ viewerRole: 'renter', turn: 'owner', listingId: 'l1' }),
      );
      menuLabels(host, fixture);
      const item = Array.from(
        document.body.querySelectorAll<HTMLElement>('.p-menu .p-menu-item-link'),
      ).find((e) => e.textContent?.includes('viewListing'));
      item!.click();
      expect(navigate).toHaveBeenCalledWith(['/listings', 'l1']);
    });
  });

  describe('review button', () => {
    const completed = { bookingStatus: 'completed', turn: 'none' } as const;

    it('shows while the viewer has not reviewed', () => {
      const { fixture, host } = setup(conversation(completed));
      fixture.detectChanges();
      expect(buttons(host)).toHaveLength(1);
    });

    it('is hidden once the viewer has reviewed (no button, done card stays)', () => {
      const { fixture, host } = setup(
        conversation(completed),
        of(reviewStatus({ canReviewRenter: false, hasRenterReview: true })),
      );
      fixture.detectChanges();
      expect(buttons(host)).toHaveLength(0);
      expect(host.querySelector('.rental-badge--done')).not.toBeNull();
    });

    it('swaps the sentence to the thanks text once reviewed, and keeps it while loading', () => {
      const reviewed = setup(
        conversation(completed),
        of(reviewStatus({ canReviewRenter: false, hasRenterReview: true })),
      );
      reviewed.fixture.detectChanges();
      expect(reviewed.host.querySelector('.rental-card__sentence')?.textContent).toContain(
        'chat.rental.completedReviewed',
      );
      TestBed.resetTestingModule();

      const loading = setup(conversation(completed), NEVER);
      loading.fixture.detectChanges();
      expect(loading.host.querySelector('.rental-card__sentence')?.textContent).toContain(
        'chat.rental.completed',
      );
      expect(loading.host.querySelector('.rental-card__sentence')?.textContent).not.toContain(
        'Reviewed',
      );
    });

    it('is hidden while loading and when the status call fails', () => {
      const loading = setup(conversation(completed), NEVER);
      loading.fixture.detectChanges();
      expect(buttons(loading.host)).toHaveLength(0);
      TestBed.resetTestingModule();

      const failed = setup(
        conversation(completed),
        throwError(() => new Error('x')),
      );
      failed.fixture.detectChanges();
      expect(buttons(failed.host)).toHaveLength(0);
    });

    it('is not fetched for non-completed bookings', () => {
      setup(conversation());
      const api = TestBed.inject(ReviewsApiService);
      expect(api.getBookingStatus).not.toHaveBeenCalled();
    });
  });

  describe('confirmation before cancelling', () => {
    function openConfirm(c: ChatConversationDetails) {
      const ctx = setup(c);
      ctx.host.querySelector<HTMLButtonElement>('.rental-card__more')!.click();
      ctx.fixture.detectChanges();
      const item = Array.from(
        document.body.querySelectorAll<HTMLElement>('.p-menu .p-menu-item-link'),
      ).find((e) => e.textContent?.includes('chat.rental.menu.'));
      return { ...ctx, item };
    }

    function clickMenu(label: string): void {
      Array.from(document.body.querySelectorAll<HTMLElement>('.p-menu .p-menu-item-link'))
        .find((e) => e.textContent?.includes(label))!
        .click();
    }

    function dialogButtons(): HTMLButtonElement[] {
      return Array.from(
        document.body.querySelectorAll<HTMLButtonElement>('.p-dialog-footer button'),
      );
    }

    it.each([
      ['requested', 'withdraw'],
      ['approved', 'cancelBooking'],
    ] as const)('%s: confirming dispatches cancelBooking', (status, label) => {
      const { fixture, dispatch } = openConfirm(
        conversation({ bookingStatus: status, viewerRole: 'renter', turn: 'owner' }),
      );
      clickMenu(`chat.rental.menu.${label}`);
      fixture.detectChanges();
      expect(dispatch).not.toHaveBeenCalled();

      const [, confirm] = dialogButtons();
      confirm.click();
      expect(dispatch).toHaveBeenCalledWith(BookingsActions.cancelBooking({ bookingId: 'b1' }));
    });

    it('rejecting (keep) does not dispatch and closes the dialog', () => {
      const { fixture, dispatch } = openConfirm(
        conversation({ viewerRole: 'renter', turn: 'owner' }),
      );
      clickMenu('chat.rental.menu.withdraw');
      fixture.detectChanges();
      const [keep] = dialogButtons();
      keep.click();
      fixture.detectChanges();
      expect(dispatch).not.toHaveBeenCalled();
      const comp = fixture.componentInstance as unknown as { confirmAction: () => unknown };
      expect(comp.confirmAction()).toBeNull();
    });
  });

  describe('renter note', () => {
    function noteText(host: HTMLElement): string | null {
      return host.querySelector('.rental-card__quote')?.textContent ?? null;
    }

    it('shows for the owner with the counterpart caption', () => {
      const { host } = setup(conversation({ renterNote: 'Please wrap it as a gift' }));
      expect(noteText(host)).toContain('Please wrap it as a gift');
      expect(noteText(host)).toContain('chat.rental.noteBy');
      expect(host.querySelector('.rental-card__quote-icon')).not.toBeNull();
    });

    it('shows for the renter with the "Your note" caption', () => {
      const { host } = setup(
        conversation({ viewerRole: 'renter', turn: 'owner', renterNote: 'Thanks!' }),
      );
      expect(noteText(host)).toContain('Thanks!');
      expect(noteText(host)).toContain('chat.rental.noteYou');
    });

    it.each([null, '', '   '])('is hidden when the note is %j', (note) => {
      const { host } = setup(conversation({ renterNote: note }));
      expect(host.querySelector('.rental-card__quote')).toBeNull();
    });
  });

  describe('compact row (collapsed)', () => {
    function compactSetup(c: ChatConversationDetails) {
      const ctx = setup(c);
      ctx.fixture.componentRef.setInput('collapsed', true);
      ctx.fixture.detectChanges();
      const expand = vi.fn();
      ctx.fixture.componentInstance.expandRequested.subscribe(expand);
      return { ...ctx, expand };
    }
    const toggle = (host: HTMLElement) =>
      host.querySelector<HTMLButtonElement>('.rental-compact__toggle')!;

    it('announces the state on the toggle and emits expandRequested when the row is tapped', () => {
      const { host, expand } = compactSetup(conversation());
      expect(toggle(host).getAttribute('aria-expanded')).toBe('false');
      const fullId = host.querySelector('.rental-card')!.closest('.rental-fold')!.id;
      expect(toggle(host).getAttribute('aria-controls')).toBe(fullId);
      toggle(host).click();
      expect(expand).toHaveBeenCalledTimes(1);
    });

    it('reuses the badge lead/rest and the sentence', () => {
      const { host } = compactSetup(conversation());
      const status = host.querySelector('.rental-compact__status')!.textContent ?? '';
      expect(status).toContain('chat.rental.badge.yourTurn');
      expect(status).toContain('chat.rental.badge.replyBy');
      expect(host.querySelector('.rental-compact__sub')?.textContent).toContain(
        'chat.rental.requested.owner',
      );
    });

    it('its action button runs the primary action without expanding the card', () => {
      const { host, dispatch, expand } = compactSetup(conversation());
      host.querySelector<HTMLButtonElement>('.rental-compact__btn')!.click();
      expect(dispatch).toHaveBeenCalledWith(
        BookingsActions.approveBookingRequest({ bookingId: 'b1' }),
      );
      expect(expand).not.toHaveBeenCalled();
    });

    it("shows the bar only on the viewer's turn, and no button without a primary action", () => {
      const owner = compactSetup(conversation());
      expect(owner.host.querySelector('.rental-compact__bar')).not.toBeNull();
      TestBed.resetTestingModule();

      const renter = compactSetup(conversation({ viewerRole: 'renter', turn: 'owner' }));
      expect(renter.host.querySelector('.rental-compact__bar')).toBeNull();
      expect(renter.host.querySelector('.rental-compact__btn')).toBeNull();
    });
  });

  it('scopes the ⋯ popup with the rental-card__menu class that carries the 44px item rule', () => {
    // jsdom does not load styles.css, so the 44px height itself is verified live; here we
    // pin the hook the global rule depends on.
    const { fixture, host } = setup(conversation({ viewerRole: 'renter', turn: 'owner' }));
    host.querySelector<HTMLButtonElement>('.rental-card__more')!.click();
    fixture.detectChanges();
    expect(document.body.querySelector('.p-menu.rental-card__menu')).not.toBeNull();
  });
});
