import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import type { ChatConversationPreview } from '../../models/chat.model';
import {
  ChatShellComponent,
  deriveRentalLayout,
  isThreadOpenUrl,
  threadIdFromUrl,
} from './chat-shell.component';

@Component({ standalone: true, template: 'thread' })
class ThreadStubComponent {}

function createFixture() {
  TestBed.configureTestingModule({
    imports: [ChatShellComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([
        {
          path: 'chat',
          component: ChatShellComponent,
          children: [{ path: ':conversationId', component: ThreadStubComponent }],
        },
      ]),
      provideMockStore({ initialState: { [chatFeatureKey]: initialChatState } }),
    ],
  });

  return TestBed.createComponent(ChatShellComponent);
}

describe('isThreadOpenUrl', () => {
  it('is true for a thread URL with a non-empty conversation id', () => {
    expect(isThreadOpenUrl('/chat/abc-123')).toBe(true);
    expect(isThreadOpenUrl('/chat/abc-123?x=1')).toBe(true);
  });

  it('is false for the inbox and a bare /chat/ with no id', () => {
    expect(isThreadOpenUrl('/chat')).toBe(false);
    expect(isThreadOpenUrl('/chat/')).toBe(false);
    expect(isThreadOpenUrl('/chat?tab=1')).toBe(false);
  });
});

function row(id: string): ChatConversationPreview {
  return { id, kind: 'booking', bookingId: `b-${id}` } as ChatConversationPreview;
}

describe('threadIdFromUrl', () => {
  it('reads the id, or null without one', () => {
    expect(threadIdFromUrl('/chat/abc?x=1')).toBe('abc');
    expect(threadIdFromUrl('/chat')).toBeNull();
    expect(threadIdFromUrl('/chat/')).toBeNull();
  });
});

describe('deriveRentalLayout', () => {
  const inbox = [
    row('r1'),
    row('r2'),
    { ...row('m1'), kind: 'moderation', bookingId: null } as ChatConversationPreview,
  ];

  it('is true for a booking row and false for a moderation row', () => {
    expect(deriveRentalLayout('/chat/r1', inbox, false)).toBe(true);
    expect(deriveRentalLayout('/chat/m1', inbox, true)).toBe(false);
  });

  it('is false on the empty /chat state', () => {
    expect(deriveRentalLayout('/chat', inbox, true)).toBe(false);
  });

  it('keeps the previous answer while the row is unknown (inbox not loaded)', () => {
    expect(deriveRentalLayout('/chat/r1', [], false)).toBe(false);
    expect(deriveRentalLayout('/chat/r1', [], true)).toBe(true);
  });

  it('rental to rental never changes the answer', () => {
    expect(deriveRentalLayout('/chat/r2', inbox, deriveRentalLayout('/chat/r1', inbox, false))).toBe(
      true,
    );
  });
});

describe('ChatShellComponent', () => {
  it('renders the rail + empty pane without throwing (no thread selected)', () => {
    const fixture = createFixture();
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('shows the empty-state pane and hosts the conversations rail when no conversation is open', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-conversations-page')).not.toBeNull();
    expect(host.querySelector('.chat-shell__empty')).not.toBeNull();
    // No `:conversationId` child is active → thread-open modifier is absent.
    expect(host.querySelector('.chat-shell--thread-open')).toBeNull();
  });

  it('opens the thread on a COLD direct-nav to /chat/:id without throwing (regression)', async () => {
    // Seed the router straight at a thread URL — no prior /chat visit — so the
    // shell is constructed while the child route is still activating. The old
    // snapshot walk threw here and left the pane blank.
    const fixture = createFixture();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/chat/abc-123');

    expect(() => fixture.detectChanges()).not.toThrow();

    const host = fixture.nativeElement as HTMLElement;
    // Thread-open modifier is present (mobile single-column shows the pane) and
    // the desktop empty-state pane is suppressed.
    expect(host.querySelector('.chat-shell--thread-open')).not.toBeNull();
    expect(host.querySelector('.chat-shell__empty')).toBeNull();
  });

  it('sets the rental layout class from the inbox row before any details load', async () => {
    const fixture = createFixture();
    const store = TestBed.inject(MockStore);
    store.setState({
      [chatFeatureKey]: {
        ...initialChatState,
        conversations: [row('r1')],
      },
    });
    await TestBed.inject(Router).navigateByUrl('/chat/r1');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.chat-shell--rental'),
    ).not.toBeNull();
  });
});
