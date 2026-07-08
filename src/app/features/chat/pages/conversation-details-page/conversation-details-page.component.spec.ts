import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import type {
  ChatConversationDetails,
  ChatMessage,
} from '../../models/chat.model';
import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ConversationDetailsPageComponent } from './conversation-details-page.component';

const CONVERSATION_ID = 'c1';

function systemMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    conversationId: CONVERSATION_ID,
    senderId: null,
    senderName: null,
    type: 'system',
    systemKind: null,
    body: null,
    attachmentUrl: null,
    sentAt: '2026-07-07T10:00:00.000Z',
    isMine: false,
    seen: false,
    ...overrides,
  };
}

function conversationWith(messages: ChatMessage[]): ChatConversationDetails {
  return {
    id: CONVERSATION_ID,
    bookingId: 'b1',
    counterpartId: 'owner-1',
    counterpartName: 'Marina',
    counterpartAvatarUrl: null,
    counterpartVerified: false,
    toyTitle: 'Wooden train',
    toyImageUrl: null,
    status: 'active',
    bookingDates: '18-22 May',
    bookingPrice: 6000,
    isClosed: false,
    messages,
  };
}

function createFixture() {
  TestBed.configureTestingModule({
    imports: [ConversationDetailsPageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({ initialState: { [chatFeatureKey]: initialChatState } }),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ conversationId: CONVERSATION_ID })),
          snapshot: {
            paramMap: convertToParamMap({ conversationId: CONVERSATION_ID }),
          },
        },
      },
    ],
  });

  const store = TestBed.inject(MockStore);
  const fixture = TestBed.createComponent(ConversationDetailsPageComponent);
  return { fixture, store };
}

describe('ConversationDetailsPageComponent', () => {
  it('initializes and renders without throwing (regression: NG0203)', () => {
    const { fixture } = createFixture();
    // ngOnInit runs here; a bare takeUntilDestroyed() would throw NG0203.
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('dispatches loadConversationDetails and markConversationRead for the route id', () => {
    const { fixture, store } = createFixture();
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fixture.detectChanges();

    const dispatched = dispatchSpy.mock.calls.map(([action]) => action);
    expect(dispatched).toContainEqual({
      type: '[Chat] Load Conversation Details',
      conversationId: CONVERSATION_ID,
    });
    expect(dispatched).toContainEqual({
      type: '[Chat] Mark Conversation Read',
      conversationId: CONVERSATION_ID,
    });
  });

  it('renders the enriched request system line only for the request kind', () => {
    const { fixture, store } = createFixture();
    store.setState({
      [chatFeatureKey]: {
        ...initialChatState,
        activeConversation: conversationWith([
          systemMessage({ id: 'req', systemKind: 'request' }),
          systemMessage({ id: 'apr', systemKind: 'approved' }),
        ]),
      },
    });

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    // The request line renders as the enriched pill with a calendar icon.
    const requestLines = host.querySelectorAll('.chat-system__line--request');
    expect(requestLines).toHaveLength(1);
    expect(requestLines[0].querySelector('.pi-calendar')).not.toBeNull();
    // Every other system kind keeps a plain, non-enriched line.
    const allLines = host.querySelectorAll('.chat-system__line');
    expect(allLines).toHaveLength(2);
    const plainLines = host.querySelectorAll(
      '.chat-system__line:not(.chat-system__line--request)',
    );
    expect(plainLines).toHaveLength(1);
  });
});
