import type { ChatStatus, ChatViewerRole } from '../../models/chat.model';
import { type RentalCardInput, mapRentalCardView } from './rental-card.view';

function input(
  status: ChatStatus,
  role: ChatViewerRole,
  overrides: Partial<RentalCardInput> = {},
): RentalCardInput {
  return {
    status,
    role,
    counterpartName: 'Anna',
    deadlineText: '21 Oct, 14:05',
    startDateText: '12 Oct',
    endDateText: '19 Oct',
    rejectionReason: null,
    canCancelApproved: true,
    ...overrides,
  };
}

function ids(view: ReturnType<typeof mapRentalCardView>) {
  return {
    primary: view?.primary?.id ?? null,
    secondary: view?.secondary?.id ?? null,
    menu: view?.menu.map((a) => a.id) ?? [],
  };
}

describe('mapRentalCardView', () => {
  it('adds the listing link before "view booking" only when hasListing', () => {
    expect(ids(mapRentalCardView(input('requested', 'renter', { hasListing: true }))).menu).toEqual(
      ['withdraw', 'viewListing', 'viewBooking'],
    );
    expect(ids(mapRentalCardView(input('requested', 'renter'))).menu).toEqual([
      'withdraw',
      'viewBooking',
    ]);
  });

  describe('requested', () => {
    it('owner: turn badge, Accept primary, Decline secondary', () => {
      const v = mapRentalCardView(input('requested', 'owner'));
      expect(v?.badgeKind).toBe('turn');
      expect(v?.leadKey).toBe('chat.rental.badge.yourTurn');
      expect(v?.restKey).toBe('chat.rental.badge.replyBy');
      expect(v?.sentenceKey).toBe('chat.rental.requested.owner');
      expect(ids(v)).toEqual({ primary: 'accept', secondary: 'decline', menu: ['viewBooking'] });
    });

    it('renter: wait badge, no button, Withdraw in the menu', () => {
      const v = mapRentalCardView(input('requested', 'renter'));
      expect(v?.badgeKind).toBe('wait');
      expect(v?.sentenceKey).toBe('chat.rental.requested.renter');
      expect(ids(v)).toEqual({ primary: null, secondary: null, menu: ['withdraw', 'viewBooking'] });
      expect(v?.menu[0].danger).toBe(true);
    });
  });

  describe('approved', () => {
    it('owner: info badge with the meeting date, "I handed it over" primary', () => {
      const v = mapRentalCardView(input('approved', 'owner'));
      expect(v?.badgeKind).toBe('info');
      expect(v?.restKey).toBe('chat.rental.badge.meetingOn');
      expect(ids(v)).toEqual({ primary: 'handedOver', secondary: null, menu: ['viewBooking'] });
    });

    it('renter: wait badge, cancel offered only before the start date', () => {
      const before = mapRentalCardView(input('approved', 'renter', { canCancelApproved: true }));
      expect(before?.badgeKind).toBe('wait');
      expect(ids(before)).toEqual({
        primary: null,
        secondary: null,
        menu: ['cancelBooking', 'viewBooking'],
      });

      const after = mapRentalCardView(input('approved', 'renter', { canCancelApproved: false }));
      expect(ids(after).menu).toEqual(['viewBooking']);
    });
  });

  describe.each(['active', 'return_due'] as const)('%s', (status) => {
    it('owner: info badge, "Received back" primary', () => {
      const v = mapRentalCardView(input(status, 'owner'));
      expect(v?.badgeKind).toBe('info');
      expect(v?.leadKey).toBe('chat.rental.badge.withRenter');
      expect(v?.restKey).toBe('chat.rental.badge.backBy');
      expect(ids(v).primary).toBe('receivedBack');
    });

    it('renter: info badge, no button', () => {
      const v = mapRentalCardView(input(status, 'renter'));
      expect(v?.badgeKind).toBe('info');
      expect(v?.leadKey).toBe('chat.rental.badge.withYou');
      expect(v?.restKey).toBe('chat.rental.badge.returnBy');
      expect(ids(v)).toEqual({ primary: null, secondary: null, menu: ['viewBooking'] });
    });
  });

  describe.each(['completed', 'closed'] as const)('%s', (status) => {
    it.each(['owner', 'renter'] as const)('%s: done badge and a review primary', (role) => {
      const v = mapRentalCardView(input(status, role));
      expect(v?.badgeKind).toBe('done');
      expect(v?.sentenceKey).toBe('chat.rental.completed');
      expect(ids(v).primary).toBe('review');
    });
  });

  describe('not_happened', () => {
    it('generic sentence when there is no reason', () => {
      const v = mapRentalCardView(input('not_happened', 'renter'));
      expect(v?.badgeKind).toBe('void');
      expect(v?.sentenceKey).toBe('chat.rental.notHappened.generic');
      expect(v?.reason).toBeNull();
      expect(ids(v).primary).toBe('findSimilar');
    });

    it('known reason code is flagged as a code (translated by the card)', () => {
      const v = mapRentalCardView(
        input('not_happened', 'renter', { rejectionReason: 'dates_unavailable' }),
      );
      expect(v?.sentenceKey).toBe('chat.rental.notHappened.declined');
      expect(v?.reason).toEqual({ kind: 'code', value: 'dates_unavailable' });
    });

    it("free text is kept verbatim as the owner's words", () => {
      const v = mapRentalCardView(
        input('not_happened', 'renter', { rejectionReason: '  Sorry, it is broken  ' }),
      );
      expect(v?.reason).toEqual({ kind: 'text', value: 'Sorry, it is broken' });
    });

    it('owner: "you declined" wording and no Find-similar button', () => {
      const v = mapRentalCardView(input('not_happened', 'owner', { rejectionReason: 'not_a_fit' }));
      expect(v?.sentenceKey).toBe('chat.rental.notHappened.declinedByYou');
      expect(ids(v).primary).toBeNull();
    });

    it('blank reason counts as no reason', () => {
      const v = mapRentalCardView(input('not_happened', 'renter', { rejectionReason: '   ' }));
      expect(v?.reason).toBeNull();
      expect(v?.sentenceKey).toBe('chat.rental.notHappened.generic');
    });
  });

  it('passes the counterpart name and formatted dates as params', () => {
    const v = mapRentalCardView(input('requested', 'owner'));
    expect(v?.params).toEqual({
      name: 'Anna',
      deadline: '21 Oct, 14:05',
      startDate: '12 Oct',
      endDate: '19 Oct',
    });
  });

  it('renders nothing for a moderation thread', () => {
    expect(mapRentalCardView(input('moderation', 'owner'))).toBeNull();
  });
});
