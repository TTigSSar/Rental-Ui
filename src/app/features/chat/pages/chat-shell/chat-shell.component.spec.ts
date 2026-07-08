import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ChatShellComponent, isThreadOpenUrl } from './chat-shell.component';

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
});
