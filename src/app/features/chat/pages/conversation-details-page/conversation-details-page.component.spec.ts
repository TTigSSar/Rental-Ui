import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ConversationDetailsPageComponent } from './conversation-details-page.component';

const CONVERSATION_ID = 'c1';

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
});
