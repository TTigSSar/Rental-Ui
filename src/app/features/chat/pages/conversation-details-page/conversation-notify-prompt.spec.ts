import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideMockActions } from '@ngrx/effects/testing';
import type { Action } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, of } from 'rxjs';

import { BrowserNotificationService } from '../../../notifications/services/browser-notification.service';
import type { ChatConversationDetails, ChatMessage } from '../../models/chat.model';
import * as ChatActions from '../../store/chat.actions';
import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ConversationDetailsPageComponent } from './conversation-details-page.component';

describe('ConversationDetailsPageComponent soft notification prompt', () => {
  const actions$ = new Subject<Action>();
  const canPrompt = signal(true);
  const dismissPrompt = vi.fn(() => canPrompt.set(false));
  const requestPermission = vi.fn().mockResolvedValue('granted');

  function setup() {
    canPrompt.set(true);
    dismissPrompt.mockClear();
    requestPermission.mockClear();
    TestBed.configureTestingModule({
      imports: [ConversationDetailsPageComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideMockActions(() => actions$),
        provideMockStore({ initialState: { [chatFeatureKey]: initialChatState } }),
        {
          provide: BrowserNotificationService,
          useValue: { canPrompt, dismissPrompt, requestPermission },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ conversationId: 'c1' })),
            snapshot: { paramMap: convertToParamMap({ conversationId: 'c1' }) },
          },
        },
      ],
    });
    TestBed.inject(MockStore).setState({
      [chatFeatureKey]: {
        ...initialChatState,
        activeConversation: {
          id: 'c1',
          kind: 'booking',
          counterpartName: 'Marina',
          isClosed: false,
          messages: [],
        } as unknown as ChatConversationDetails,
      },
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      chat: { notifyPrompt: { title: 'T', text: 'X', turnOn: 'Turn on', notNow: 'Not now' } },
    });
    translate.use('en');
    const fixture = TestBed.createComponent(ConversationDetailsPageComponent);
    fixture.detectChanges();
    return fixture;
  }

  const sent = () =>
    ChatActions.sendMessageSuccess({ message: { id: 'm' } as unknown as ChatMessage });
  const prompt = (el: HTMLElement) => el.querySelector('.chat-notify-prompt');

  it('is hidden until the user has sent a message on this device', () => {
    const fixture = setup();
    expect(prompt(fixture.nativeElement)).toBeNull();
    actions$.next(sent());
    fixture.detectChanges();
    expect(prompt(fixture.nativeElement)).not.toBeNull();
  });

  it('stays hidden after a send when the service says it cannot prompt', () => {
    const fixture = setup();
    canPrompt.set(false);
    actions$.next(sent());
    fixture.detectChanges();
    expect(prompt(fixture.nativeElement)).toBeNull();
  });

  it('Turn on dismisses for good and opens the browser dialog', () => {
    const fixture = setup();
    actions$.next(sent());
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.chat-notify-prompt__primary') as HTMLElement).click();
    fixture.detectChanges();
    expect(dismissPrompt).toHaveBeenCalledOnce();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(prompt(fixture.nativeElement)).toBeNull();
  });

  it('Not now dismisses without asking the browser', () => {
    const fixture = setup();
    actions$.next(sent());
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.chat-notify-prompt__quiet') as HTMLElement).click();
    fixture.detectChanges();
    expect(dismissPrompt).toHaveBeenCalledOnce();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(prompt(fixture.nativeElement)).toBeNull();
  });
});
