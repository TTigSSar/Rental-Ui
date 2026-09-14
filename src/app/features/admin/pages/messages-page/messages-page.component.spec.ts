import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, type ParamMap } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

import { makeAdminMessageThread, makeAdminUser } from '../../../../../testing/fixtures';
import type { ChatConversationDetails, ChatMessage } from '../../../chat/models/chat.model';
import * as AdminMessagesActions from '../../store/admin-messages.actions';
import { adminMessagesFeatureKey } from '../../store/admin-messages.reducer';
import { initialAdminMessagesState } from '../../store/admin-messages.state';
import * as AdminUsersActions from '../../store/admin-users.actions';
import { adminUsersFeatureKey } from '../../store/admin-users.reducer';
import { initialAdminUsersState, type AdminUsersState } from '../../store/admin-users.state';
import { MessagesPageComponent } from './messages-page.component';

function mockMatchMedia(matchesDesktop: boolean): void {
  (window as unknown as { matchMedia: typeof matchMedia }).matchMedia = ((query: string) => ({
    matches: query === '(min-width: 961px)' ? matchesDesktop : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia;
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'm1',
    conversationId: 'conv-1',
    senderId: 'user-2',
    senderName: 'Anahit',
    type: 'text',
    systemKind: null,
    noteKind: null,
    noteSubject: null,
    noteReason: null,
    body: 'Hello',
    attachmentUrl: null,
    sentAt: '2026-08-13T10:00:00.000Z',
    isMine: false,
    seen: true,
    ...overrides,
  };
}

function makeDetails(overrides: Partial<ChatConversationDetails> = {}): ChatConversationDetails {
  return {
    id: 'conv-1',
    kind: 'moderation',
    bookingId: null,
    counterpartId: 'user-2',
    counterpartName: 'Anahit Grigoryan',
    counterpartAvatarUrl: null,
    counterpartVerified: true,
    toyTitle: null,
    toyImageUrl: null,
    status: 'moderation',
    bookingDates: null,
    bookingPrice: null,
    isClosed: false,
    messages: [],
    ...overrides,
  };
}

describe('MessagesPageComponent', () => {
  let fixture: ComponentFixture<MessagesPageComponent>;
  let store: MockStore;
  let router: { navigate: ReturnType<typeof vi.fn> };

  async function setup(
    overrides: Partial<typeof initialAdminMessagesState> = {},
    queryParams: Record<string, string> = {},
    desktop = true,
    usersOverrides: Partial<AdminUsersState> = {},
  ): Promise<{ paramMap$: BehaviorSubject<ParamMap> }> {
    mockMatchMedia(desktop);
    router = { navigate: vi.fn() };
    const paramMap$ = new BehaviorSubject(convertToParamMap(queryParams));
    await TestBed.configureTestingModule({
      imports: [MessagesPageComponent, TranslateModule.forRoot()],
      providers: [
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(queryParams) },
            queryParamMap: paramMap$,
          },
        },
        provideMockStore({
          initialState: {
            [adminMessagesFeatureKey]: { ...initialAdminMessagesState, ...overrides },
            [adminUsersFeatureKey]: { ...initialAdminUsersState, ...usersOverrides },
          },
        }),
      ],
    }).compileComponents();
    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(MessagesPageComponent);
    fixture.detectChanges();
    return { paramMap$ };
  }

  // ── Mount / deep-link entry ──
  describe('mount behaviour', () => {
    it('always loads the thread queue and clears any stale selection when there is no userId param', async () => {
      mockMatchMedia(true);
      router = { navigate: vi.fn() };
      const paramMap$ = new BehaviorSubject(convertToParamMap({}));
      await TestBed.configureTestingModule({
        imports: [MessagesPageComponent, TranslateModule.forRoot()],
        providers: [
          { provide: Router, useValue: router },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParamMap: convertToParamMap({}) },
              queryParamMap: paramMap$,
            },
          },
          provideMockStore({
            initialState: {
              [adminMessagesFeatureKey]: {
                ...initialAdminMessagesState,
                selectedThreadId: 'stale-conv',
              },
              [adminUsersFeatureKey]: initialAdminUsersState,
            },
          }),
        ],
      }).compileComponents();
      store = TestBed.inject(MockStore);
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture = TestBed.createComponent(MessagesPageComponent);
      fixture.detectChanges();

      expect(dispatchSpy).toHaveBeenCalledWith(AdminMessagesActions.loadMessageThreads());
      expect(dispatchSpy).toHaveBeenCalledWith(AdminMessagesActions.clearSelectedMessageThread());
    });

    it('translates a ?userId= query param into openMessageThreadForUser and strips it from the URL', async () => {
      mockMatchMedia(true);
      router = { navigate: vi.fn() };
      const paramMap$ = new BehaviorSubject(convertToParamMap({ userId: 'user-9' }));
      await TestBed.configureTestingModule({
        imports: [MessagesPageComponent, TranslateModule.forRoot()],
        providers: [
          { provide: Router, useValue: router },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { queryParamMap: convertToParamMap({ userId: 'user-9' }) },
              queryParamMap: paramMap$,
            },
          },
          provideMockStore({
            initialState: {
              [adminMessagesFeatureKey]: initialAdminMessagesState,
              [adminUsersFeatureKey]: initialAdminUsersState,
            },
          }),
        ],
      }).compileComponents();
      store = TestBed.inject(MockStore);
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture = TestBed.createComponent(MessagesPageComponent);
      fixture.detectChanges();

      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminMessagesActions.openMessageThreadForUser({ userId: 'user-9' }),
      );
      expect(dispatchSpy).toHaveBeenCalledWith(AdminMessagesActions.loadMessageThreads());
      // Not cleared: a deep link's initial selection must survive mount.
      expect(dispatchSpy).not.toHaveBeenCalledWith(
        AdminMessagesActions.clearSelectedMessageThread(),
      );
      expect(router.navigate).toHaveBeenCalledWith([], {
        relativeTo: expect.anything(),
        queryParams: {},
        replaceUrl: true,
      });
    });

    it('reacts when the userId query param changes while the component stays alive', async () => {
      const { paramMap$ } = await setup({}, {});
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      paramMap$.next(convertToParamMap({ userId: 'user-42' }));
      fixture.detectChanges();

      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminMessagesActions.openMessageThreadForUser({ userId: 'user-42' }),
      );
    });
  });

  // ── Queue states ──
  describe('thread queue states', () => {
    it('shows the loading skeleton while the queue is loading with no items yet', async () => {
      await setup({ isLoading: true, items: [] });
      expect(
        fixture.nativeElement.querySelectorAll('.messages-page__skeleton-row').length,
      ).toBeGreaterThan(0);
    });

    it('shows the empty state once loaded with no threads', async () => {
      await setup({ isLoading: false, items: [] });
      expect(fixture.nativeElement.querySelector('.messages-page__list-empty')).not.toBeNull();
    });

    it('renders one row per thread', async () => {
      await setup({
        items: [
          makeAdminMessageThread({ conversationId: 'c1' }),
          makeAdminMessageThread({ conversationId: 'c2', memberFirstName: 'Narek' }),
        ],
      });
      expect(fixture.nativeElement.querySelectorAll('.messages-page__row').length).toBe(2);
    });

    it('previews a moderationNote row as "Note: {subject}", not the raw note body', async () => {
      await setup({
        items: [
          makeAdminMessageThread({
            conversationId: 'c1',
            lastMessageType: 'moderationNote',
            lastMessageNoteSubject: 'Wooden train set',
            lastMessageSnippet: 'Please resubmit with clearer photos.',
          }),
        ],
      });
      const preview = fixture.nativeElement.querySelector('.messages-page__row-preview');
      // No translation loader in this spec (`TranslateModule.forRoot()` with no loader renders
      // the raw key), so match on the i18n key rather than its interpolated English rendering —
      // same idiom as `reports-page.component.spec.ts`'s tab-label assertions.
      expect(preview?.textContent?.trim()).toBe('admin.messages.list.notePreview');
    });

    it('falls back sensibly when a moderationNote row has no subject', async () => {
      await setup({
        items: [
          makeAdminMessageThread({
            conversationId: 'c1',
            lastMessageType: 'moderationNote',
            lastMessageNoteSubject: null,
            lastMessageSnippet: 'Please resubmit with clearer photos.',
          }),
        ],
      });
      const preview = fixture.nativeElement.querySelector('.messages-page__row-preview');
      expect(preview?.textContent?.trim()).toBe('admin.messages.list.noteNoSubject');
    });

    it('shows an error with retry and dispatches loadMessageThreads on retry', async () => {
      await setup({ error: 'Something broke' });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const retryBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__retry-btn',
      );
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminMessagesActions.loadMessageThreads());
    });
  });

  // ── Filters ──
  describe('filter switching (desktop)', () => {
    it('marks the active filter pill as pressed and the others as not', async () => {
      await setup({ filter: 'unread' });
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.messages-page__filter-btn'),
      );
      const unreadBtn = buttons.find((b) =>
        b.textContent?.includes('admin.messages.filters.unread'),
      );
      const allBtn = buttons.find((b) => b.textContent?.includes('admin.messages.filters.all'));
      expect(unreadBtn?.getAttribute('aria-pressed')).toBe('true');
      expect(allBtn?.getAttribute('aria-pressed')).toBe('false');
    });

    it('dispatches setMessageThreadFilter when a pill is clicked', async () => {
      await setup({ filter: 'all' });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.messages-page__filter-btn'),
      );
      const replyBtn = buttons.find((b) => b.textContent?.includes('admin.messages.filters.reply'));
      expect(replyBtn).toBeTruthy();
      replyBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminMessagesActions.setMessageThreadFilter({ filter: 'needsReply' }),
      );
    });

    it('shows all three pill counts simultaneously (search-filtered, not pill-filtered) regardless of which pill is active', async () => {
      await setup({
        filter: 'unread',
        counts: { all: 12, unread: 4, needsReply: 7 },
      });
      const buttons: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('.messages-page__filter-btn'),
      );
      const allBtn = buttons.find((b) => b.textContent?.includes('admin.messages.filters.all'));
      const unreadBtn = buttons.find((b) =>
        b.textContent?.includes('admin.messages.filters.unread'),
      );
      const replyBtn = buttons.find((b) => b.textContent?.includes('admin.messages.filters.reply'));
      expect(allBtn?.querySelector('.messages-page__filter-count')?.textContent?.trim()).toBe('12');
      expect(unreadBtn?.querySelector('.messages-page__filter-count')?.textContent?.trim()).toBe(
        '4',
      );
      expect(replyBtn?.querySelector('.messages-page__filter-count')?.textContent?.trim()).toBe(
        '7',
      );
    });
  });

  // ── Selecting a thread ──
  describe('selecting a thread', () => {
    it('dispatches selectMessageThread when a conversation row is clicked', async () => {
      await setup({ items: [makeAdminMessageThread({ conversationId: 'conv-7' })] });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const rowBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__row-main',
      );
      rowBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminMessagesActions.selectMessageThread({ conversationId: 'conv-7' }),
      );
    });

    it("dispatches loadAdminUserLookup with the row's memberId when its avatar is clicked — the real fetch, not a thread-built fabrication", async () => {
      await setup({
        items: [makeAdminMessageThread({ conversationId: 'conv-7', memberId: 'user-9' })],
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const avatarBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__avatar-btn',
      );
      avatarBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminUsersActions.loadAdminUserLookup({ userId: 'user-9' }),
      );
    });
  });

  // ── Profile dialog — fetches the real AdminUser (ADR-014: no fabricated zeros) ──
  describe('profile dialog', () => {
    it('shows a loading state while the lookup is in flight, not a dialog with fabricated zeros', async () => {
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: null, loading: true, error: null },
      });
      expect(fixture.nativeElement.querySelector('app-admin-user-profile-dialog')).toBeNull();
      expect(fixture.nativeElement.querySelector('.messages-page__profile-status')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
    });

    it('shows an error state with a retry control on failure', async () => {
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: null, loading: false, error: 'Network error' },
      });
      expect(fixture.nativeElement.querySelector('app-admin-user-profile-dialog')).toBeNull();
      const status = fixture.nativeElement.querySelector('.messages-page__profile-status');
      expect(status).not.toBeNull();
      expect(status.textContent).toContain('Network error');

      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const retryBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__retry-btn',
      );
      retryBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminUsersActions.loadAdminUserLookup({ userId: 'user-9' }),
      );
    });

    it('renders the dialog with the real fetched user once the lookup resolves — no fabricated email/listing/rental counts', async () => {
      const realUser = makeAdminUser({
        id: 'user-9',
        email: 'anahit@toyrent.am',
        listingCount: 12,
        rentalCount: 47,
      });
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: realUser, loading: false, error: null },
      });
      const dialog = fixture.nativeElement.querySelector('app-admin-user-profile-dialog');
      expect(dialog).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.messages-page__profile-status')).toBeNull();
      expect(dialog.textContent).toContain('anahit@toyrent.am');
      const statValues = Array.from(
        fixture.nativeElement.querySelectorAll('.admin-user-profile-dialog__stat-value'),
      ).map((el: unknown) => (el as HTMLElement).textContent?.trim());
      expect(statValues).toEqual(['12', '47', '0']);
    });

    it('dispatches clearAdminUserLookup when the ready dialog is closed', async () => {
      const realUser = makeAdminUser({ id: 'user-9' });
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: realUser, loading: false, error: null },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const closeBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.admin-user-profile-dialog__close',
      );
      closeBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminUsersActions.clearAdminUserLookup());
    });

    it('dispatches clearAdminUserLookup when the loading/error status card is closed', async () => {
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: null, loading: true, error: null },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const closeBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__profile-status-close',
      );
      closeBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminUsersActions.clearAdminUserLookup());
    });

    it('dispatches the same verify/suspend/reactivate actions the Users screen uses, not a close-only no-op', async () => {
      const realUser = makeAdminUser({ id: 'user-9', status: 'Pending' });
      await setup({}, {}, true, {
        lookup: { userId: 'user-9', user: realUser, loading: false, error: null },
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      const verifyBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.admin-user-profile-dialog__action--primary',
      );
      verifyBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminUsersActions.verifyUser({ userId: 'user-9' }));

      const suspendBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.admin-user-profile-dialog__action--danger',
      );
      suspendBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminUsersActions.suspendUser({ userId: 'user-9' }));
    });
  });

  // ── Thread detail / composer ──
  describe('an open thread', () => {
    it('renders a moderationNote message through app-moderation-note-card, not a chat bubble', async () => {
      const note = makeMessage({
        id: 'n1',
        type: 'moderationNote',
        noteKind: 'reject',
        noteSubject: 'Wooden train set',
        noteReason: 'Photos too blurry',
        body: 'Please resubmit with clearer photos.',
      });
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1', messages: [note] }),
        items: [makeAdminMessageThread({ conversationId: 'conv-1' })],
      });

      expect(fixture.nativeElement.querySelector('app-moderation-note-card')).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.messages-page__bubble').length).toBe(0);
    });

    it('shows the start-of-conversation copy when there are no messages yet', async () => {
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1', messages: [] }),
        items: [makeAdminMessageThread({ conversationId: 'conv-1' })],
      });
      expect(fixture.nativeElement.querySelector('.messages-page__thread-empty')).not.toBeNull();
    });

    it('disables the send button while the draft is blank', async () => {
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1' }),
      });
      const sendBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__send-btn',
      );
      expect(sendBtn?.disabled).toBe(true);
    });

    it('sends on Enter, dispatching sendMessageThreadMessage with the trimmed draft', async () => {
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1' }),
      });
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector(
        '.messages-page__composer-input',
      );
      textarea.value = 'Hello there';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dispatchSpy = vi.spyOn(store, 'dispatch');
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();

      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminMessagesActions.sendMessageThreadMessage({
          conversationId: 'conv-1',
          content: 'Hello there',
        }),
      );
    });

    it('does not send on Shift+Enter (newline instead)', async () => {
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1' }),
      });
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector(
        '.messages-page__composer-input',
      );
      textarea.value = 'Hello';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const dispatchSpy = vi.spyOn(store, 'dispatch');
      textarea.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      fixture.detectChanges();

      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('disables the send button while a send is already in flight', async () => {
      await setup({
        selectedThreadId: 'conv-1',
        selectedThreadDetail: makeDetails({ id: 'conv-1' }),
        sending: true,
      });
      const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector(
        '.messages-page__composer-input',
      );
      textarea.value = 'Hello';
      textarea.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      const sendBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__send-btn',
      );
      expect(sendBtn?.disabled).toBe(true);
    });
  });

  // ── Mobile breakpoint ──
  describe('mobile layout', () => {
    it('shows the conversation list (with no thread selected)', async () => {
      await setup({}, {}, false);
      expect(fixture.nativeElement.querySelector('.messages-page__mobile-list')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.messages-page__mobile-thread')).toBeNull();
    });

    it('shows the full-screen thread once a thread is selected', async () => {
      await setup(
        {
          selectedThreadId: 'conv-1',
          selectedThreadDetail: makeDetails({ id: 'conv-1' }),
          items: [makeAdminMessageThread({ conversationId: 'conv-1' })],
        },
        {},
        false,
      );
      expect(fixture.nativeElement.querySelector('.messages-page__mobile-thread')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.messages-page__mobile-list')).toBeNull();
    });

    it('keeps the active-pill modifier class on the filter button rendered inside the mobile filter row', async () => {
      // Regression guard for a specificity collision: `.messages-page__filters--mobile
      // .messages-page__filter-btn` (2 classes) used to win over `.messages-page__filter-btn--active`
      // (1 class) for `background`, leaving white text on a white pill below the desktop
      // breakpoint. A unit test can't assert computed colour, but it can assert the precondition
      // the CSS fix depends on: the active button is a descendant of `.messages-page__filters--mobile`
      // AND still carries `--active`, so the mobile variant rule must not re-claim its background.
      await setup({ filter: 'unread' }, {}, false);
      const mobileFilters = fixture.nativeElement.querySelector('.messages-page__filters--mobile');
      expect(mobileFilters).not.toBeNull();
      const activeBtn: HTMLButtonElement | null = mobileFilters?.querySelector(
        '.messages-page__filter-btn--active',
      );
      expect(activeBtn).not.toBeNull();
      expect(activeBtn?.getAttribute('aria-pressed')).toBe('true');
      expect(activeBtn?.textContent).toContain('admin.messages.filters.unread');
    });

    it('dispatches clearSelectedMessageThread when the back button is pressed', async () => {
      await setup(
        {
          selectedThreadId: 'conv-1',
          selectedThreadDetail: makeDetails({ id: 'conv-1' }),
          items: [makeAdminMessageThread({ conversationId: 'conv-1' })],
        },
        {},
        false,
      );
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      const backBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '.messages-page__back-btn',
      );
      backBtn?.click();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminMessagesActions.clearSelectedMessageThread());
    });
  });
});
