import { chatNotificationSnippet, shouldNotifyChatMessage } from './chat-browser-notify.util';
import type { ChatRealtimeMessage } from './chat.model';

function msg(overrides: Partial<ChatRealtimeMessage> = {}): ChatRealtimeMessage {
  return {
    id: 'm1',
    conversationId: 'c1',
    senderId: 'other',
    senderName: 'Anna',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hi',
    attachmentUrl: null,
    latitude: null,
    longitude: null,
    meetingPointKind: null,
    sentAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  };
}

const base = { currentUserId: 'me', pageHidden: true, permission: 'granted' } as const;

describe('shouldNotifyChatMessage', () => {
  it('notifies for a hidden tab, granted permission and a message from someone else', () => {
    expect(shouldNotifyChatMessage({ ...base, message: msg() })).toBe(true);
    expect(shouldNotifyChatMessage({ ...base, message: msg({ type: 'image' }) })).toBe(true);
  });

  it('stays quiet while the tab is visible', () => {
    expect(shouldNotifyChatMessage({ ...base, pageHidden: false, message: msg() })).toBe(false);
  });

  it.each(['default', 'denied', 'unsupported'] as const)(
    'stays quiet when permission is %s',
    (permission) => {
      expect(shouldNotifyChatMessage({ ...base, permission, message: msg() })).toBe(false);
    },
  );

  it('stays quiet for own messages and system lines', () => {
    expect(shouldNotifyChatMessage({ ...base, message: msg({ senderId: 'me' }) })).toBe(false);
    expect(shouldNotifyChatMessage({ ...base, message: msg({ senderId: null }) })).toBe(false);
    expect(shouldNotifyChatMessage({ ...base, message: msg({ type: 'system' }) })).toBe(false);
  });

  it('notifies for a moderation note unless the current user wrote it', () => {
    const note = (senderId: string | null) =>
      shouldNotifyChatMessage({ ...base, message: msg({ type: 'moderationNote', senderId }) });
    expect(note('admin')).toBe(true);
    expect(note(null)).toBe(true);
    expect(note('me')).toBe(false);
    expect(
      shouldNotifyChatMessage({
        ...base,
        pageHidden: false,
        message: msg({ type: 'moderationNote', senderId: 'admin' }),
      }),
    ).toBe(false);
  });

  it('stays quiet when nobody is signed in (ADR-036)', () => {
    expect(shouldNotifyChatMessage({ ...base, currentUserId: null, message: msg() })).toBe(false);
  });
});

describe('chatNotificationSnippet', () => {
  it('returns null for an empty or missing body', () => {
    expect(chatNotificationSnippet(null)).toBeNull();
    expect(chatNotificationSnippet('   ')).toBeNull();
  });

  it('keeps short text and collapses whitespace', () => {
    expect(chatNotificationSnippet('  Hi \n there ')).toBe('Hi there');
  });

  it('truncates long text to about 100 characters', () => {
    const out = chatNotificationSnippet('a'.repeat(250)) ?? '';
    expect(out.length).toBe(101);
    expect(out.endsWith('…')).toBe(true);
  });
});
