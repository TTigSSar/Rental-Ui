import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import * as BookingsActions from '../../../bookings/store/bookings.actions';
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

function setup(c: ChatConversationDetails) {
  const actions$ = new Subject<unknown>();
  TestBed.configureTestingModule({
    imports: [RentalCardComponent, TranslateModule.forRoot()],
    providers: [provideRouter([]), provideMockStore(), { provide: Actions, useValue: actions$ }],
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

  it('scopes the ⋯ popup with the rental-card__menu class that carries the 44px item rule', () => {
    // jsdom does not load styles.css, so the 44px height itself is verified live; here we
    // pin the hook the global rule depends on.
    const { fixture, host } = setup(conversation({ viewerRole: 'renter', turn: 'owner' }));
    host.querySelector<HTMLButtonElement>('.rental-card__more')!.click();
    fixture.detectChanges();
    expect(document.body.querySelector('.p-menu.rental-card__menu')).not.toBeNull();
  });
});
