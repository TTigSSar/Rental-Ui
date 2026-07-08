import type { ChatConversationPreview } from './chat.model';
import { chatDayKey, chatDayLabel, filterConversations } from './chat-ui.util';

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
});

function preview(overrides: Partial<ChatConversationPreview>): ChatConversationPreview {
  return {
    id: 'x',
    bookingId: 'bk',
    counterpartName: 'Name',
    counterpartAvatarUrl: null,
    toyTitle: 'Toy',
    toyImageUrl: null,
    status: 'active',
    lastMessageSnippet: null,
    lastMessageAt: null,
    unreadCount: 0,
    ...overrides,
  };
}
