import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { FormControl, FormGroup } from '@angular/forms';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import type { Action, Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import type { MockInstance } from 'vitest';

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

function imageMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'img-1',
    conversationId: CONVERSATION_ID,
    senderId: 'renter-1',
    senderName: 'Ada',
    type: 'image',
    systemKind: null,
    body: null,
    attachmentUrl: '/uploads/chat/c1/photo.jpg',
    sentAt: '2026-07-07T10:00:00.000Z',
    isMine: true,
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
  // Load just the counter strings so the translate pipe interpolates params
  // (the real bundle isn't wired into unit tests).
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation(
    'en',
    {
      chat: {
        details: {
          charCounter: '{{count}} / {{max}}',
          limitReached: 'Message limit of {{max}} characters reached',
          imageTooLarge: 'This photo is too large. Maximum size is {{max}} MB.',
          imageInvalidType:
            'Unsupported file type. Use a JPEG, PNG, WebP or GIF image.',
        },
      },
    },
    true,
  );
  translate.use('en');
  const fixture = TestBed.createComponent(ConversationDetailsPageComponent);
  return { fixture, store };
}

/** Reaches the component's reactive composer form (protected in the component). */
function messageForm(
  fixture: ComponentFixture<ConversationDetailsPageComponent>,
): FormGroup<{ content: FormControl<string> }> {
  return (
    fixture.componentInstance as unknown as {
      messageForm: FormGroup<{ content: FormControl<string> }>;
    }
  ).messageForm;
}

/** Renders the composer for an open conversation and types `content`. */
function typeContent(
  fixture: ComponentFixture<ConversationDetailsPageComponent>,
  store: MockStore,
  content: string,
): HTMLElement {
  store.setState({
    [chatFeatureKey]: {
      ...initialChatState,
      activeConversation: conversationWith([]),
    },
  });
  fixture.detectChanges();
  messageForm(fixture).controls.content.setValue(content);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
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

  describe('composer character counter', () => {
    it('stays hidden for short content', () => {
      const { fixture, store } = createFixture();
      const host = typeContent(fixture, store, 'a'.repeat(10));

      expect(host.querySelector('.chat-thread__composer-counter')).toBeNull();
    });

    it('appears with the live count once the threshold is reached', () => {
      const { fixture, store } = createFixture();
      const host = typeContent(fixture, store, 'a'.repeat(3500));

      const counter = host.querySelector('.chat-thread__composer-counter');
      expect(counter).not.toBeNull();
      expect(
        counter?.classList.contains('chat-thread__composer-counter--limit'),
      ).toBe(false);
      expect(counter?.textContent?.trim()).toBe('3500 / 4000');
    });

    it('switches to the limit-reached state at exactly the limit', () => {
      const { fixture, store } = createFixture();
      const host = typeContent(fixture, store, 'a'.repeat(4000));

      const counter = host.querySelector('.chat-thread__composer-counter');
      expect(counter).not.toBeNull();
      expect(
        counter?.classList.contains('chat-thread__composer-counter--limit'),
      ).toBe(true);
      expect(counter?.textContent?.trim()).toBe(
        'Message limit of 4000 characters reached',
      );
    });
  });

  describe('image messages', () => {
    it('renders the attachment as a real <img>, with the caption under it', () => {
      const { fixture, store } = createFixture();
      store.setState({
        [chatFeatureKey]: {
          ...initialChatState,
          activeConversation: conversationWith([
            imageMessage({ body: 'Look at this train' }),
          ]),
        },
      });

      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const img = host.querySelector<HTMLImageElement>('.chat-bubble__image');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('/uploads/chat/c1/photo.jpg');
      expect(img?.getAttribute('loading')).toBe('lazy');
      // The caption doubles as the alt text when present.
      expect(img?.getAttribute('alt')).toBe('Look at this train');
      expect(
        host.querySelector('.chat-bubble__caption')?.textContent?.trim(),
      ).toBe('Look at this train');
    });

    it('renders the optimistic pending bubble while the upload is in flight', () => {
      const { fixture, store } = createFixture();
      store.setState({
        [chatFeatureKey]: {
          ...initialChatState,
          activeConversation: conversationWith([]),
          pendingImage: {
            conversationId: CONVERSATION_ID,
            previewUrl: 'blob:preview',
            caption: null,
            failed: false,
          },
        },
      });

      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      const pending = host.querySelector('.chat-bubble--pending');
      expect(pending).not.toBeNull();
      expect(pending?.classList.contains('chat-bubble--failed')).toBe(false);
      expect(
        pending?.querySelector<HTMLImageElement>('.chat-bubble__image')?.getAttribute('src'),
      ).toBe('blob:preview');
      expect(pending?.querySelector('.pi-spinner')).not.toBeNull();
    });
  });

  describe('image picker validation (client-side, before upload)', () => {
    /** Invokes the component's protected file-input handler with a picked file. */
    async function pick(
      fixture: ComponentFixture<ConversationDetailsPageComponent>,
      file: File,
    ): Promise<void> {
      const input = { files: [file], value: 'C:\\fakepath\\x' };
      await (
        fixture.componentInstance as unknown as {
          onImageSelected(event: Event): Promise<void>;
        }
      ).onImageSelected({ target: input } as unknown as Event);
    }

    /**
     * The dispatched actions, typed as plain `Action`s. `Store.dispatch` is
     * overloaded (it also accepts an action CREATOR), so the spy's arg type is
     * the creator signature — narrow it back to what the component actually
     * dispatches.
     */
    function dispatchedActions(spy: MockInstance<Store['dispatch']>): Action[] {
      return spy.mock.calls.map(([action]) => action as unknown as Action);
    }

    /** A file of `size` bytes without actually allocating them. */
    function fileOfSize(name: string, type: string, size: number): File {
      const file = new File(['x'], name, { type });
      Object.defineProperty(file, 'size', { value: size });
      return file;
    }

    beforeEach(() => {
      // jsdom has no object-URL support in this runner; the component only needs
      // an opaque handle for the optimistic preview.
      URL.createObjectURL = vi.fn(() => 'blob:preview');
      URL.revokeObjectURL = vi.fn();
    });

    it('rejects a file whose type is not an allowed image type', async () => {
      const { fixture, store } = createFixture();
      fixture.detectChanges();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      await pick(fixture, fileOfSize('doc.pdf', 'application/pdf', 1000));

      const dispatched = dispatchedActions(dispatchSpy);
      expect(dispatched).toContainEqual({
        type: '[Chat] Send Image Message Failure',
        error: 'Unsupported file type. Use a JPEG, PNG, WebP or GIF image.',
      });
      expect(
        dispatched.some((action) => action.type === '[Chat] Send Image Message'),
      ).toBe(false);
    });

    it('rejects a file over the 5 MB attachment cap', async () => {
      const { fixture, store } = createFixture();
      fixture.detectChanges();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      await pick(fixture, fileOfSize('huge.jpg', 'image/jpeg', 6 * 1024 * 1024));

      const dispatched = dispatchedActions(dispatchSpy);
      expect(dispatched).toContainEqual({
        type: '[Chat] Send Image Message Failure',
        error: 'This photo is too large. Maximum size is 5 MB.',
      });
      expect(
        dispatched.some((action) => action.type === '[Chat] Send Image Message'),
      ).toBe(false);
    });

    it('dispatches sendImageMessage for a valid file, with the composer text as caption', async () => {
      const { fixture, store } = createFixture();
      fixture.detectChanges();
      messageForm(fixture).controls.content.setValue('  Look at this  ');
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      await pick(fixture, fileOfSize('photo.png', 'image/png', 1024));

      const sent = dispatchedActions(dispatchSpy).find(
        (action) => action.type === '[Chat] Send Image Message',
      ) as
        | { conversationId: string; caption: string | null; previewUrl: string }
        | undefined;
      expect(sent).toBeDefined();
      expect(sent?.conversationId).toBe(CONVERSATION_ID);
      expect(sent?.caption).toBe('Look at this');
      expect(sent?.previewUrl).toBe('blob:preview');
      // The caption left the composer with the image.
      expect(messageForm(fixture).controls.content.value).toBe('');
    });
  });

  describe('composer length validator', () => {
    it('invalidates the form when content exceeds the limit', () => {
      const { fixture } = createFixture();
      fixture.detectChanges();

      const form = messageForm(fixture);
      form.controls.content.setValue('a'.repeat(4001));

      expect(form.invalid).toBe(true);
    });

    it('keeps the form valid at exactly the limit', () => {
      const { fixture } = createFixture();
      fixture.detectChanges();

      const form = messageForm(fixture);
      form.controls.content.setValue('a'.repeat(4000));

      expect(form.valid).toBe(true);
    });
  });
});
