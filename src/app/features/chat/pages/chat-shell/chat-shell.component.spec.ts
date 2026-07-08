import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { chatFeatureKey } from '../../store/chat.reducer';
import { initialChatState } from '../../store/chat.state';
import { ChatShellComponent } from './chat-shell.component';

function createFixture() {
  TestBed.configureTestingModule({
    imports: [ChatShellComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({ initialState: { [chatFeatureKey]: initialChatState } }),
    ],
  });

  return TestBed.createComponent(ChatShellComponent);
}

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
});
