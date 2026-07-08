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
});
