import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { ChatConversationPreview } from '../../models/chat.model';
import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ConversationsPageComponent } from './conversations-page.component';

function preview(overrides: Partial<ChatConversationPreview>): ChatConversationPreview {
  return {
    id: 'c1',
    bookingId: 'b1',
    counterpartName: 'Marina',
    counterpartAvatarUrl: null,
    toyTitle: 'Wooden train',
    toyImageUrl: null,
    status: 'active',
    lastMessageSnippet: 'Enjoy! Ping me any time.',
    lastMessageAt: '2026-07-07T10:00:00.000Z',
    lastMessageType: 'text',
    lastMessageIsMine: false,
    unreadCount: 0,
    ...overrides,
  };
}

function createFixture(conversations: ChatConversationPreview[]) {
  TestBed.configureTestingModule({
    imports: [ConversationsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [chatFeatureKey]: { ...initialChatState, conversations },
        },
      }),
    ],
  });

  TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(ConversationsPageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('ConversationsPageComponent', () => {
  it('prefixes the snippet on rows where the last message is mine', () => {
    const fixture = createFixture([
      preview({ id: 'mine', lastMessageIsMine: true }),
      preview({ id: 'theirs', lastMessageIsMine: false }),
    ]);

    const host = fixture.nativeElement as HTMLElement;
    const prefixes = host.querySelectorAll('.chat-row__snippet-prefix');
    // Exactly one row (the own-last-message one) carries the "You:" prefix.
    expect(prefixes).toHaveLength(1);
  });

  it('omits the prefix when there is no last-message snippet', () => {
    const fixture = createFixture([
      preview({ id: 'empty', lastMessageIsMine: true, lastMessageSnippet: null }),
    ]);

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.chat-row__snippet-prefix')).toBeNull();
  });

  describe('image last message', () => {
    it('labels an uncaptioned image row instead of leaving the snippet empty', () => {
      const fixture = createFixture([
        preview({
          id: 'img',
          lastMessageType: 'image',
          lastMessageSnippet: null,
          lastMessageIsMine: false,
        }),
      ]);

      const host = fixture.nativeElement as HTMLElement;
      const snippet = host.querySelector('.chat-row__snippet')?.textContent?.trim();
      // TranslateModule.forRoot() with no bundle echoes the key back.
      expect(snippet).toBe('chat.conversations.photo');
      expect(host.querySelector('.chat-row__snippet-prefix')).toBeNull();
    });

    it('keeps the "You:" prefix on my own uncaptioned image', () => {
      const fixture = createFixture([
        preview({
          id: 'img-mine',
          lastMessageType: 'image',
          lastMessageSnippet: null,
          lastMessageIsMine: true,
        }),
      ]);

      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('.chat-row__snippet-prefix')).not.toBeNull();
      expect(host.querySelector('.chat-row__snippet')?.textContent).toContain(
        'chat.conversations.photo',
      );
    });

    it('shows the caption (not the Photo label) when the image has one', () => {
      const fixture = createFixture([
        preview({
          id: 'img-caption',
          lastMessageType: 'image',
          lastMessageSnippet: 'Look at this',
        }),
      ]);

      const host = fixture.nativeElement as HTMLElement;
      const snippet = host.querySelector('.chat-row__snippet')?.textContent?.trim();
      expect(snippet).toBe('Look at this');
    });
  });
});
