import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { ChatMessage } from '../../models/chat.model';
import { ModerationNoteCardComponent } from './moderation-note-card.component';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'note-1',
    conversationId: 'c1',
    senderId: 'moderator-1',
    senderName: 'DoRent Team',
    type: 'moderationNote',
    systemKind: null,
    noteKind: 'reject',
    noteSubject: 'Wooden train set',
    noteReason: 'Photos too blurry',
    body: 'Please resubmit with clearer photos.',
    attachmentUrl: null,
    sentAt: '2026-07-07T10:00:00.000Z',
    isMine: false,
    seen: true,
    ...overrides,
  };
}

function createFixture(input: Partial<ChatMessage> = {}, audience?: 'member' | 'moderator') {
  TestBed.configureTestingModule({
    imports: [ModerationNoteCardComponent, TranslateModule.forRoot()],
  });
  const fixture = TestBed.createComponent(ModerationNoteCardComponent);
  fixture.componentRef.setInput('message', message(input));
  if (audience) {
    fixture.componentRef.setInput('audience', audience);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ModerationNoteCardComponent', () => {
  it('renders the subject, reason and body', () => {
    const host = createFixture();

    expect(host.querySelector('.mod-note__subject')?.textContent?.trim()).toBe('Wooden train set');
    expect(host.querySelector('.mod-note__reason')?.textContent).toContain('Photos too blurry');
    expect(host.querySelector('.mod-note__text')?.textContent?.trim()).toBe(
      'Please resubmit with clearer photos.',
    );
  });

  it('omits the subject/reason paragraphs when they are null', () => {
    const host = createFixture({ noteSubject: null, noteReason: null });

    expect(host.querySelector('.mod-note__subject')).toBeNull();
    expect(host.querySelector('.mod-note__reason')).toBeNull();
  });

  it('shows the "by {sender}" line when a sender name is present', () => {
    const host = createFixture({ senderName: 'DoRent Team' });

    // TranslateModule.forRoot() with no bundle echoes the key back untranslated
    // (see the sibling conversations-page/conversation-details-page specs) —
    // this just asserts the by-line renders at all for a non-null sender.
    expect(host.querySelector('.mod-note__by')?.textContent?.trim()).toBe('chat.note.by');
  });

  it('omits the "by" line when the sender name is null', () => {
    const host = createFixture({ senderName: null });

    expect(host.querySelector('.mod-note__by')).toBeNull();
  });

  describe('the five note kinds', () => {
    it('reject: x icon, danger tone', () => {
      const host = createFixture({ noteKind: 'reject' });
      expect(host.querySelector('.mod-note')?.className).toContain('mod-note--danger');
      expect(host.querySelector('.mod-note__kind-label')?.textContent?.trim()).toBe(
        'chat.note.kind.reject',
      );
    });

    it('warn: flag icon, warn tone', () => {
      const host = createFixture({ noteKind: 'warn' });
      expect(host.querySelector('.mod-note')?.className).toContain('mod-note--warn');
      expect(host.querySelector('.mod-note__kind-label')?.textContent?.trim()).toBe(
        'chat.note.kind.warn',
      );
    });

    it('suspend: shield icon, danger tone', () => {
      const host = createFixture({ noteKind: 'suspend' });
      expect(host.querySelector('.mod-note')?.className).toContain('mod-note--danger');
      expect(host.querySelector('.mod-note__kind-label')?.textContent?.trim()).toBe(
        'chat.note.kind.suspend',
      );
    });

    it('category: tag icon, info tone', () => {
      const host = createFixture({ noteKind: 'category' });
      expect(host.querySelector('.mod-note')?.className).toContain('mod-note--info');
      expect(host.querySelector('.mod-note__kind-label')?.textContent?.trim()).toBe(
        'chat.note.kind.category',
      );
    });

    it('info: message icon, info tone', () => {
      const host = createFixture({ noteKind: 'info' });
      expect(host.querySelector('.mod-note')?.className).toContain('mod-note--info');
      expect(host.querySelector('.mod-note__kind-label')?.textContent?.trim()).toBe(
        'chat.note.kind.info',
      );
    });
  });

  describe('audience-dependent footer copy', () => {
    it('defaults to the member-appropriate footer', () => {
      const host = createFixture();
      expect(host.querySelector('.mod-note__footer')?.textContent).toContain(
        'chat.note.footerMember',
      );
    });

    it('shows the moderator-appropriate footer when audience is "moderator"', () => {
      const host = createFixture({}, 'moderator');
      expect(host.querySelector('.mod-note__footer')?.textContent).toContain(
        'chat.note.footerModerator',
      );
    });
  });
});
