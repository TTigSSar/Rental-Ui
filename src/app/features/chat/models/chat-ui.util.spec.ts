import type { ChatConversationPreview } from './chat.model';
import {
  chatDayKey,
  chatDayLabel,
  filterConversations,
  mapChatStatusIcon,
  mapChatStatusLabelKey,
  mapChatStatusTone,
  mapModerationNoteMeta,
} from './chat-ui.util';

describe('mapChatStatusTone', () => {
  it('maps requested to pending', () => {
    expect(mapChatStatusTone('requested')).toBe('pending');
  });

  it('maps completed to approved (finished, still-open thread — distinct from neutral closed)', () => {
    expect(mapChatStatusTone('completed')).toBe('approved');
  });

  it('maps closed to neutral', () => {
    expect(mapChatStatusTone('closed')).toBe('neutral');
  });

  it('maps moderation to neutral (a Moderation thread never progresses like a booking)', () => {
    expect(mapChatStatusTone('moderation')).toBe('neutral');
  });
});

describe('mapChatStatusIcon', () => {
  it('maps moderation to the shield glyph', () => {
    expect(mapChatStatusIcon('moderation')).toBe('pi pi-shield');
  });
});

describe('mapChatStatusLabelKey', () => {
  it('maps requested to its label key', () => {
    expect(mapChatStatusLabelKey('requested')).toBe('chat.status.requested');
  });

  it('maps completed to its label key', () => {
    expect(mapChatStatusLabelKey('completed')).toBe('chat.status.completed');
  });

  it('maps closed to its label key', () => {
    expect(mapChatStatusLabelKey('closed')).toBe('chat.status.closed');
  });

  it('maps moderation to its own label key (not the closed fallback)', () => {
    expect(mapChatStatusLabelKey('moderation')).toBe('chat.status.moderation');
  });
});

describe('mapModerationNoteMeta', () => {
  it('maps reject to the x icon and danger tone', () => {
    expect(mapModerationNoteMeta('reject')).toEqual({
      icon: 'x',
      labelKey: 'chat.note.kind.reject',
      tone: 'danger',
    });
  });

  it('maps warn to the flag icon and warn tone', () => {
    expect(mapModerationNoteMeta('warn')).toEqual({
      icon: 'flag',
      labelKey: 'chat.note.kind.warn',
      tone: 'warn',
    });
  });

  it('maps suspend to the shield icon and danger tone', () => {
    expect(mapModerationNoteMeta('suspend')).toEqual({
      icon: 'shield',
      labelKey: 'chat.note.kind.suspend',
      tone: 'danger',
    });
  });

  it('maps category to the tag icon and info tone', () => {
    expect(mapModerationNoteMeta('category')).toEqual({
      icon: 'tag',
      labelKey: 'chat.note.kind.category',
      tone: 'info',
    });
  });

  it('maps info to the message icon and info tone', () => {
    expect(mapModerationNoteMeta('info')).toEqual({
      icon: 'message',
      labelKey: 'chat.note.kind.info',
      tone: 'info',
    });
  });

  it('falls back to the info kind for an unrecognized/null noteKind', () => {
    expect(mapModerationNoteMeta(null)).toEqual({
      icon: 'message',
      labelKey: 'chat.note.kind.info',
      tone: 'info',
    });
  });
});

describe('chatDayKey', () => {
  it('produces a local YYYY-MM-DD key', () => {
    // Construct a local date so the assertion is timezone-independent.
    const local = new Date(2026, 4, 18, 9, 30); // 18 May 2026, 09:30 local
    expect(chatDayKey(local.toISOString())).toBe('2026-05-18');
  });

  it('groups two timestamps on the same local day under one key', () => {
    const morning = new Date(2026, 4, 18, 0, 5).toISOString();
    const evening = new Date(2026, 4, 18, 23, 55).toISOString();
    expect(chatDayKey(morning)).toBe(chatDayKey(evening));
  });

  it('returns the raw input for an unparseable date', () => {
    expect(chatDayKey('not-a-date')).toBe('not-a-date');
  });
});

describe('chatDayLabel', () => {
  const now = new Date(2026, 4, 18, 12, 0); // Mon 18 May 2026, noon local

  it('labels the same day as today', () => {
    const sameDay = new Date(2026, 4, 18, 8, 0).toISOString();
    expect(chatDayLabel(sameDay, now)).toEqual({ kind: 'today' });
  });

  it('labels the previous day as yesterday', () => {
    const dayBefore = new Date(2026, 4, 17, 23, 0).toISOString();
    expect(chatDayLabel(dayBefore, now)).toEqual({ kind: 'yesterday' });
  });

  it('labels 2-6 days ago with a short weekday', () => {
    const threeDaysAgo = new Date(2026, 4, 15, 10, 0).toISOString();
    const label = chatDayLabel(threeDaysAgo, now);
    expect(label.kind).toBe('date');
    expect(label.kind === 'date' && label.text.length).toBeGreaterThan(0);
  });

  it('labels a week or more ago with a day-month string', () => {
    const older = new Date(2026, 3, 20, 10, 0).toISOString();
    const label = chatDayLabel(older, now);
    expect(label.kind).toBe('date');
    expect(label.kind === 'date' && label.text.length).toBeGreaterThan(0);
  });
});

describe('filterConversations', () => {
  const conversations: ChatConversationPreview[] = [
    preview({ id: 'a', counterpartName: 'Anna Owner', toyTitle: 'Wooden Train' }),
    preview({ id: 'b', counterpartName: 'Boris Renter', toyTitle: 'LEGO City Set' }),
    preview({ id: 'c', counterpartName: 'Carla', toyTitle: 'Toy train station' }),
  ];

  it('returns all conversations for a blank query', () => {
    expect(filterConversations(conversations, '   ')).toHaveLength(3);
  });

  it('matches on counterpart name case-insensitively', () => {
    const result = filterConversations(conversations, 'boris');
    expect(result.map((c) => c.id)).toEqual(['b']);
  });

  it('matches on toy title case-insensitively', () => {
    const result = filterConversations(conversations, 'TRAIN');
    expect(result.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterConversations(conversations, 'zzz')).toEqual([]);
  });

  it('does not mutate the source array', () => {
    const copy = [...conversations];
    filterConversations(conversations, 'train');
    expect(conversations).toEqual(copy);
  });

  describe('a Moderation conversation (kind === "moderation", toyTitle null)', () => {
    const withModeration: ChatConversationPreview[] = [
      ...conversations,
      preview({
        id: 'mod',
        kind: 'moderation',
        bookingId: null,
        counterpartName: 'DoRent Support',
        toyTitle: null,
      }),
    ];

    it('does not throw on a null toyTitle (regression: TS18047 crash)', () => {
      expect(() => filterConversations(withModeration, 'anything')).not.toThrow();
    });

    it('is found by counterpart name like any other conversation', () => {
      const result = filterConversations(withModeration, 'dorent support');
      expect(result.map((c) => c.id)).toEqual(['mod']);
    });

    it('is never matched by a toy-title query (it has no toy)', () => {
      const result = filterConversations(withModeration, 'train');
      expect(result.map((c) => c.id).includes('mod')).toBe(false);
    });

    it('is still included for a blank query alongside booking conversations', () => {
      expect(filterConversations(withModeration, '')).toHaveLength(4);
    });
  });
});

function preview(overrides: Partial<ChatConversationPreview>): ChatConversationPreview {
  return {
    id: 'x',
    kind: 'booking',
    bookingId: 'bk',
    counterpartName: 'Name',
    counterpartAvatarUrl: null,
    toyTitle: 'Toy',
    toyImageUrl: null,
    status: 'active',
    lastMessageSnippet: null,
    lastMessageAt: null,
    lastMessageType: null,
    lastMessageIsMine: false,
    unreadCount: 0,
    ...overrides,
  };
}
