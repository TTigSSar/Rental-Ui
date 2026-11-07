import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { selectAuthUser } from '../../auth/store/auth.selectors';
import { BrowserNotificationService } from '../../notifications/services/browser-notification.service';
import type { ChatRealtimeMessage } from '../models/chat.model';
import { ChatBrowserNotifier } from './chat-browser-notifier.service';

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
    body: 'Is the stroller free?',
    attachmentUrl: null,
    latitude: null,
    longitude: null,
    meetingPointKind: null,
    sentAt: '2026-11-07T10:00:00.000Z',
    ...overrides,
  };
}

describe('ChatBrowserNotifier', () => {
  const close = vi.fn();
  let show: ReturnType<typeof vi.fn>;
  let hidden: boolean;
  let permission: string;
  let navigate: ReturnType<typeof vi.fn>;

  function setup(user: { id: string } | null = { id: 'me' }) {
    show = vi.fn().mockReturnValue(close);
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideMockStore(),
        { provide: Router, useValue: { navigate } },
        {
          provide: BrowserNotificationService,
          useValue: {
            refresh: () => {},
            isPageHidden: () => hidden,
            permission: () => permission,
            show,
          },
        },
      ],
    });
    TestBed.inject(MockStore).overrideSelector(selectAuthUser, user as never);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      chat: {
        notify: { photo: 'Photo', location: 'Meeting point', moderation: 'DoRent Moderation' },
      },
    });
    translate.use('en');
    return TestBed.inject(ChatBrowserNotifier);
  }

  beforeEach(() => {
    hidden = true;
    permission = 'granted';
    close.mockClear();
  });

  it('shows sender name and message start, tagged by conversation', () => {
    setup().notify(msg());
    expect(show).toHaveBeenCalledOnce();
    expect(show.mock.calls[0][0]).toMatchObject({
      title: 'Anna',
      body: 'Is the stroller free?',
      tag: 'c1',
    });
  });

  it('uses a localized Photo body for an image-only message', () => {
    setup().notify(msg({ type: 'image', body: null }));
    expect(show.mock.calls[0][0].body).toBe('Photo');
  });

  it('shows a moderation note with the sender name, or the localized moderation title', () => {
    const notifier = setup();
    notifier.notify(msg({ type: 'moderationNote', senderName: 'Admin', body: 'Listing rejected' }));
    notifier.notify(
      msg({ type: 'moderationNote', senderId: null, senderName: null, body: 'Note' }),
    );
    expect(show.mock.calls[0][0]).toMatchObject({ title: 'Admin', body: 'Listing rejected' });
    expect(show.mock.calls[1][0]).toMatchObject({ title: 'DoRent Moderation', body: 'Note' });
  });

  it('does not notify the admin about their own moderation note', () => {
    setup().notify(msg({ type: 'moderationNote', senderId: 'me' }));
    expect(show).not.toHaveBeenCalled();
  });

  it('click focuses the window and opens that chat', () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
    setup().notify(msg());
    show.mock.calls[0][0].onClick();
    expect(focus).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/chat', 'c1']);
  });

  it('does nothing while visible, without permission, or for own/system messages', () => {
    const notifier = setup();
    hidden = false;
    notifier.notify(msg());
    hidden = true;
    permission = 'default';
    notifier.notify(msg());
    permission = 'granted';
    notifier.notify(msg({ senderId: 'me' }));
    notifier.notify(msg({ type: 'system' }));
    expect(show).not.toHaveBeenCalled();
  });

  it('does nothing after sign-out (no current user)', () => {
    setup(null).notify(msg());
    expect(show).not.toHaveBeenCalled();
  });

  it('closeAll closes what is open', () => {
    const notifier = setup();
    notifier.notify(msg());
    notifier.closeAll();
    expect(close).toHaveBeenCalledOnce();
    notifier.closeAll();
    expect(close).toHaveBeenCalledOnce();
  });
});
