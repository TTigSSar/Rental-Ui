import type { ChatStatus, ChatViewerRole } from '../../models/chat.model';

/** Visual kind of the turn badge (design: `RC_BADGE` in rc-parts.jsx). */
export type RentalBadgeKind = 'turn' | 'wait' | 'info' | 'done' | 'void';

/** What a card button / menu entry does. The component maps each id to a dispatch or a route. */
export type RentalActionId =
  | 'accept'
  | 'decline'
  | 'withdraw'
  | 'cancelBooking'
  | 'handedOver'
  | 'receivedBack'
  | 'review'
  | 'findSimilar'
  | 'viewBooking';

export interface RentalCardAction {
  readonly id: RentalActionId;
  readonly labelKey: string;
  /** Rendered in the danger colour (menu entries that end the rental). */
  readonly danger?: boolean;
}

/** Owner's stated reason for declining: a known code (translated) or free text (shown verbatim). */
export interface RentalCardReason {
  readonly kind: 'code' | 'text';
  readonly value: string;
}

/** Everything the mapping needs. Dates arrive pre-formatted so the function stays pure. */
export interface RentalCardInput {
  readonly status: ChatStatus;
  readonly role: ChatViewerRole;
  readonly counterpartName: string;
  /** Formatted `deadlineAt` (Yerevan time); empty when the booking has no deadline. */
  readonly deadlineText: string;
  readonly startDateText: string;
  readonly endDateText: string;
  /** Owner's stored rejection reason (code or free text), if any. */
  readonly rejectionReason: string | null;
  /** Renter may still cancel an Approved booking (start date is in the future). */
  readonly canCancelApproved: boolean;
}

export interface RentalCardView {
  readonly badgeKind: RentalBadgeKind;
  readonly leadKey: string;
  readonly restKey: string | null;
  readonly sentenceKey: string;
  /** Interpolation params shared by the badge keys and the sentence key. */
  readonly params: Readonly<Record<string, string>>;
  readonly reason: RentalCardReason | null;
  readonly primary: RentalCardAction | null;
  readonly secondary: RentalCardAction | null;
  /** Secondary actions for the ⋯ menu (always ends with "view booking details"). */
  readonly menu: readonly RentalCardAction[];
}

const KNOWN_REASON_CODES: readonly string[] = [
  'dates_unavailable',
  'item_unavailable',
  'not_a_fit',
];

const VIEW_BOOKING: RentalCardAction = {
  id: 'viewBooking',
  labelKey: 'chat.rental.menu.viewBooking',
};

function action(id: RentalActionId, labelKey: string, danger = false): RentalCardAction {
  return danger ? { id, labelKey, danger } : { id, labelKey };
}

function reasonOf(raw: string | null): RentalCardReason | null {
  const value = raw?.trim() ?? '';
  if (value.length === 0) {
    return null;
  }
  return KNOWN_REASON_CODES.includes(value) ? { kind: 'code', value } : { kind: 'text', value };
}

/**
 * Maps a booking's chat status and the viewer's role to what the rental card shows:
 * badge kind, i18n keys, and the actions. Pure — it never decides WHOSE TURN it is
 * (the server's `turn` does; the card's top bar compares `turn === viewerRole`), it
 * only decides what to say and offer for a given state.
 *
 * Returns null for states the card does not render (moderation threads).
 */
export function mapRentalCardView(input: RentalCardInput): RentalCardView | null {
  const owner = input.role === 'owner';
  const params = {
    name: input.counterpartName,
    deadline: input.deadlineText,
    startDate: input.startDateText,
    endDate: input.endDateText,
  };
  const base = { params, reason: null, secondary: null, primary: null } as const;

  switch (input.status) {
    case 'requested':
      return owner
        ? {
            ...base,
            badgeKind: 'turn',
            leadKey: 'chat.rental.badge.yourTurn',
            restKey: 'chat.rental.badge.replyBy',
            sentenceKey: 'chat.rental.requested.owner',
            primary: action('accept', 'chat.rental.action.accept'),
            secondary: action('decline', 'chat.rental.action.decline'),
            menu: [VIEW_BOOKING],
          }
        : {
            ...base,
            badgeKind: 'wait',
            leadKey: 'chat.rental.badge.nothingNeeded',
            restKey: 'chat.rental.badge.waitingUntil',
            sentenceKey: 'chat.rental.requested.renter',
            menu: [action('withdraw', 'chat.rental.menu.withdraw', true), VIEW_BOOKING],
          };

    case 'approved':
      return owner
        ? {
            ...base,
            badgeKind: 'info',
            leadKey: 'chat.rental.badge.agreed',
            restKey: 'chat.rental.badge.meetingOn',
            sentenceKey: 'chat.rental.approved.owner',
            primary: action('handedOver', 'chat.rental.action.handedOver'),
            menu: [VIEW_BOOKING],
          }
        : {
            ...base,
            badgeKind: 'wait',
            leadKey: 'chat.rental.badge.nothingNeeded',
            restKey: 'chat.rental.badge.meetingOn',
            sentenceKey: 'chat.rental.approved.renter',
            menu: input.canCancelApproved
              ? [action('cancelBooking', 'chat.rental.menu.cancelBooking', true), VIEW_BOOKING]
              : [VIEW_BOOKING],
          };

    case 'active':
    case 'return_due':
      return owner
        ? {
            ...base,
            badgeKind: 'info',
            leadKey: 'chat.rental.badge.withRenter',
            restKey: 'chat.rental.badge.backBy',
            sentenceKey: 'chat.rental.active.owner',
            primary: action('receivedBack', 'chat.rental.action.receivedBack'),
            menu: [VIEW_BOOKING],
          }
        : {
            ...base,
            badgeKind: 'info',
            leadKey: 'chat.rental.badge.withYou',
            restKey: 'chat.rental.badge.returnBy',
            sentenceKey: 'chat.rental.active.renter',
            menu: [VIEW_BOOKING],
          };

    case 'completed':
    case 'closed':
      return {
        ...base,
        badgeKind: 'done',
        leadKey: 'chat.rental.badge.completed',
        restKey: null,
        sentenceKey: 'chat.rental.completed',
        primary: action('review', 'chat.rental.action.review'),
        menu: [VIEW_BOOKING],
      };

    case 'not_happened': {
      const reason = reasonOf(input.rejectionReason);
      return {
        ...base,
        badgeKind: 'void',
        leadKey: 'chat.rental.badge.didNotHappen',
        restKey: null,
        sentenceKey: reason
          ? owner
            ? 'chat.rental.notHappened.declinedByYou'
            : 'chat.rental.notHappened.declined'
          : 'chat.rental.notHappened.generic',
        reason,
        primary: owner ? null : action('findSimilar', 'chat.rental.action.findSimilar'),
        menu: [VIEW_BOOKING],
      };
    }

    default:
      return null;
  }
}
