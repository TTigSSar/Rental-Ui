import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { debounceTime, distinctUntilChanged, filter as rxFilter, map, skip } from 'rxjs';

import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { selectAuthUser } from '../../../auth/store/auth.selectors';
import { ModerationNoteCardComponent } from '../../../chat/components/moderation-note-card/moderation-note-card.component';
import { CHAT_MESSAGE_MAX_LENGTH, type ChatMessage } from '../../../chat/models/chat.model';
import { AdminPageHeaderComponent } from '../../components/admin-page-header/admin-page-header.component';
import { AdminUserProfileDialogComponent } from '../../components/admin-user-profile-dialog/admin-user-profile-dialog.component';
import { AdminUserStatusPillComponent } from '../../components/admin-user-status-pill/admin-user-status-pill.component';
import type {
  AdminMessageThread,
  AdminMessageThreadFilter,
} from '../../models/admin-message-thread.model';
import * as AdminMessagesActions from '../../store/admin-messages.actions';
import {
  selectMessageThreadCounts,
  selectMessageThreadFilter,
  selectMessageThreadItems,
  selectMessageThreadPage,
  selectMessageThreadSearch,
  selectMessageThreadTotalPages,
  selectMessageThreadsError,
  selectMessageThreadsLoading,
  selectOpeningThreadForUser,
  selectSelectedThreadDetail,
  selectSelectedThreadId,
  selectSendingThreadMessage,
  selectThreadDetailError,
  selectThreadDetailLoading,
} from '../../store/admin-messages.selectors';
import * as AdminUsersActions from '../../store/admin-users.actions';
import {
  selectUserActionIds,
  selectUserLookupError,
  selectUserLookupLoading,
  selectUserLookupUser,
  selectUserLookupUserId,
} from '../../store/admin-users.selectors';
import { AdminBreakpointService } from '../../utils/admin-breakpoint.service';
import { canSuspendUser, suspendDisabledReasonKey } from '../../utils/admin-user-guards.util';

const FILTERS: readonly { id: AdminMessageThreadFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'admin.messages.filters.all' },
  { id: 'unread', labelKey: 'admin.messages.filters.unread' },
  { id: 'needsReply', labelKey: 'admin.messages.filters.reply' },
];

/**
 * `/admin/messages` — the redesigned Messages screen (`AdminMessagesDesktop` /
 * `AdminMessagesMobile`): a 316px conversation list (search + filter pills) beside a chat panel
 * on desktop, and a single-screen list-or-full-thread toggle on mobile (bottom nav hidden while
 * a thread is open — see the `.messages-page__mobile-thread` overlay in the stylesheet, since
 * this component cannot reach into `AdminShellComponent` to toggle its nav).
 *
 * The data layer (store/services/routing/nav badge) was already built — this component only
 * dispatches into it. `selectMessageThread` / `markMessageThreadRead` / realtime updates are
 * fully handled by `AdminMessagesEffects`; this component never re-implements them.
 *
 * Reachable as `/admin/messages?userId=<id>` (the Users row menu, the report-detail dialog's
 * contact buttons, and `owner-trust-panel`'s "Message owner" all deep-link here) — the query
 * param is read on mount and on every subsequent change while this component stays alive
 * (`route.queryParamMap`, since Angular reuses the same instance for a same-route
 * query-param-only navigation), translated into `openMessageThreadForUser` (get-or-create, which
 * itself chains into `selectMessageThread`), and stripped from the URL right after so a refresh
 * doesn't silently re-open the same thread.
 *
 * The avatar-click profile dialog fetches the real `AdminUser` via the admin-users store's
 * single-user lookup slice (`AdminUsersActions.loadAdminUserLookup` /
 * `selectUserLookup*` in `admin-users.selectors.ts`) rather than building one out of the
 * `AdminMessageThread` row: `AdminMessageThreadResponse` carries no `email`/`listingCount`/
 * `rentalCount`, and rendering those as `''`/`0` would show a fabricated "0 listings, 0 rentals"
 * for a member who may have plenty of both (ADR-014's rule: a number with no source is worse
 * than a missing block). `AdminUsersApiService.getUserById` — already used by the Users screen —
 * is reused unchanged; no new endpoint or service. Verify/Suspend/Reactivate dispatch the same
 * `AdminUsersActions` the Users screen's row menu and profile dialog do (not a close-only no-op)
 * so the two screens agree on what those buttons do; the lookup slice's `settleMutationSuccess`
 * handling keeps this dialog's data fresh after a mutation the same way `users-page`'s own
 * `effect()`/`Actions` subscription does for its dialog.
 */
@Component({
  selector: 'app-admin-messages-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    AdminUserProfileDialogComponent,
    AdminUserStatusPillComponent,
    AvatarComponent,
    DatePipe,
    IconComponent,
    MessageModule,
    ModerationNoteCardComponent,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesPageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly breakpoint = inject(AdminBreakpointService);
  protected readonly isDesktop = this.breakpoint.isDesktop;

  protected readonly filters = FILTERS;
  protected readonly maxMessageLength = CHAT_MESSAGE_MAX_LENGTH;

  // ── Queue (thread list) ──
  protected readonly items = this.store.selectSignal(selectMessageThreadItems);
  protected readonly filter = this.store.selectSignal(selectMessageThreadFilter);
  /** Search-filtered (not pill-filtered) totals for the three filter pills — same values
   *  whichever pill is active. See `selectMessageThreadCounts`. */
  protected readonly counts = this.store.selectSignal(selectMessageThreadCounts);
  protected readonly page = this.store.selectSignal(selectMessageThreadPage);
  protected readonly totalPages = this.store.selectSignal(selectMessageThreadTotalPages);
  protected readonly isLoading = this.store.selectSignal(selectMessageThreadsLoading);
  protected readonly error = this.store.selectSignal(selectMessageThreadsError);
  private readonly storeSearch = this.store.selectSignal(selectMessageThreadSearch);

  protected readonly showListSkeleton = computed(
    () => this.isLoading() && this.items().length === 0,
  );
  protected readonly showListEmpty = computed(
    () => !this.isLoading() && this.items().length === 0 && this.error() === null,
  );

  // ── Search (debounced 300ms, same delay as reports-page/users-page) ──
  protected readonly searchInput = signal(this.storeSearch());

  // ── Selected thread detail ──
  protected readonly selectedThreadId = this.store.selectSignal(selectSelectedThreadId);
  protected readonly selectedThreadDetail = this.store.selectSignal(selectSelectedThreadDetail);
  protected readonly detailLoading = this.store.selectSignal(selectThreadDetailLoading);
  protected readonly detailError = this.store.selectSignal(selectThreadDetailError);
  protected readonly sending = this.store.selectSignal(selectSendingThreadMessage);
  protected readonly opening = this.store.selectSignal(selectOpeningThreadForUser);

  /**
   * The thread-queue row matching the current selection, kept live via the `effect()` below —
   * needed because `ChatConversationDetails` (what `selectedThreadDetail` holds) carries none of
   * the admin-only derived fields (`memberStatus`/`memberMarketplaceRole`/`memberOpenFlagCount`)
   * the "{role} · {status}" header line and the profile dialog need. Deliberately NOT cleared
   * just because the row drops out of the filtered `items()` (e.g. marking a thread read while
   * viewing the "Unread" tab removes it from that list) — same "keep dialog data live" idiom as
   * `reports-page`/`users-page`'s own `effect()` over their selected row.
   */
  private readonly selectedThreadRowSignal = signal<AdminMessageThread | null>(null);
  protected readonly selectedThreadRow = this.selectedThreadRowSignal.asReadonly();

  protected readonly showDetailSkeleton = computed(() => {
    const id = this.selectedThreadId();
    if (id === null) return false;
    const detail = this.selectedThreadDetail();
    return this.detailLoading() && (detail === null || detail.id !== id);
  });
  protected readonly showDetailError = computed(
    () => this.detailError() !== null && !this.showDetailSkeleton(),
  );
  protected readonly showDetailReady = computed(() => {
    const id = this.selectedThreadId();
    const detail = this.selectedThreadDetail();
    return id !== null && detail !== null && detail.id === id && this.detailError() === null;
  });
  /** Desktop chat panel's idle "nothing selected" state — also covers the brief window where a
   *  `?userId=` deep link is still opening/creating the thread (no id yet, but not truly idle). */
  protected readonly showDetailIdle = computed(
    () => this.selectedThreadId() === null && !this.opening(),
  );
  /** Mobile switches to the full-screen thread as soon as a deep link starts opening, not only
   *  once the thread id lands — otherwise the list would flash for a moment first. */
  protected readonly showMobileThreadScreen = computed(
    () => this.selectedThreadId() !== null || this.opening(),
  );

  // ── Composer ──
  protected readonly draft = signal('');
  protected readonly canSend = computed(() => this.draft().trim().length > 0 && !this.sending());
  private readonly composerInput = viewChild<ElementRef<HTMLTextAreaElement>>('composerInput');

  // ── Scroll-to-newest ──
  private readonly messagesPane = viewChild<ElementRef<HTMLElement>>('messagesPane');
  private readonly threadScrollKey = computed(() => {
    const detail = this.selectedThreadDetail();
    return detail ? `${detail.id}:${detail.messages.length}` : null;
  });

  // ── Profile dialog (fetched from the admin-users store's single-user lookup slice — see this
  // component's doc comment) ──
  protected readonly profileUserId = this.store.selectSignal(selectUserLookupUserId);
  protected readonly profileUser = this.store.selectSignal(selectUserLookupUser);
  protected readonly profileLoading = this.store.selectSignal(selectUserLookupLoading);
  protected readonly profileError = this.store.selectSignal(selectUserLookupError);
  protected readonly profileOpen = computed(() => this.profileUserId() !== null);

  private readonly currentUser = this.store.selectSignal(selectAuthUser);
  private readonly currentUserId = computed(() => this.currentUser()?.id ?? null);
  private readonly userActionIds = this.store.selectSignal(selectUserActionIds);

  protected readonly profileBusy = computed(() => {
    const id = this.profileUserId();
    return id !== null && this.userActionIds().includes(id);
  });
  protected readonly profileCanSuspend = computed(() => {
    const user = this.profileUser();
    return user === null ? true : canSuspendUser(user, this.currentUserId());
  });
  protected readonly profileSuspendReasonKey = computed(() => {
    const user = this.profileUser();
    return user === null ? null : suspendDisabledReasonKey(user, this.currentUserId());
  });

  constructor() {
    toObservable(this.searchInput)
      .pipe(skip(1), debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => {
        this.store.dispatch(AdminMessagesActions.setMessageThreadSearch({ search }));
      });

    effect(() => {
      const id = this.selectedThreadId();
      if (id === null) {
        this.selectedThreadRowSignal.set(null);
        return;
      }
      const row = this.items().find((item) => item.conversationId === id);
      if (row) this.selectedThreadRowSignal.set(row);
    });

    // Pin the message pane to the newest message — afterRenderEffect runs after the DOM has
    // been updated, so scrollHeight already reflects freshly appended messages (initial load,
    // realtime arrivals, and post-send alike). Same idiom as conversation-details-page.
    afterRenderEffect(() => {
      const key = this.threadScrollKey();
      const pane = this.messagesPane()?.nativeElement;
      if (key === null || !pane) return;
      pane.scrollTop = pane.scrollHeight;
    });

    // Auto-grow the composer textarea (min 44px, max 120px desktop / 110px mobile) — re-runs on
    // every draft change, which also covers the reset-to-empty case after a send.
    afterRenderEffect(() => {
      this.draft();
      const el = this.composerInput()?.nativeElement;
      if (!el) return;
      el.style.height = 'auto';
      const max = this.isDesktop() ? 120 : 110;
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    });
  }

  ngOnInit(): void {
    // Populates the list panel regardless of whether this mount also carries a `?userId=` deep
    // link — `openMessageThreadForUser` only upserts the one thread it opens, it doesn't load
    // the rest of the queue.
    this.store.dispatch(AdminMessagesActions.loadMessageThreads());

    if (this.route.snapshot.queryParamMap.get('userId') === null) {
      // No deep-link param on this mount — clear any selection left in the store from a
      // previous visit (e.g. opened a thread, navigated away, came back via the nav link) so
      // the screen starts on the list, not a stale thread.
      this.store.dispatch(AdminMessagesActions.clearSelectedMessageThread());
    }

    this.route.queryParamMap
      .pipe(
        map((params) => params.get('userId')),
        rxFilter((userId): userId is string => userId !== null),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((userId) => {
        this.store.dispatch(AdminMessagesActions.openMessageThreadForUser({ userId }));
        // Strip the param immediately so a refresh doesn't silently re-open the same thread.
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      });
  }

  // ── List helpers ──
  protected displayName(thread: AdminMessageThread): string {
    return `${thread.memberFirstName} ${thread.memberLastName}`.trim() || thread.memberId;
  }

  protected firstName(name: string): string {
    return name.trim().split(/\s+/)[0] || name;
  }

  protected previewText(thread: AdminMessageThread): string {
    if (thread.lastMessageType === 'moderationNote') {
      const subject = thread.lastMessageNoteSubject?.trim();
      return subject && subject.length > 0
        ? this.translate.instant('admin.messages.list.notePreview', { subject })
        : this.translate.instant('admin.messages.list.noteNoSubject');
    }
    const snippet = thread.lastMessageSnippet?.trim();
    return snippet && snippet.length > 0
      ? snippet
      : this.translate.instant('admin.messages.list.noMessagesYet');
  }

  /** Live count for a filter pill — `f.id` is always one of `counts()`'s own keys
   *  (`AdminMessageThreadFilter` and `AdminMessageThreadCounts` share the same three names). */
  protected pillCount(filterId: AdminMessageThreadFilter): number {
    return this.counts()[filterId];
  }

  protected roleStatusText(row: AdminMessageThread): string {
    const role = this.translate.instant(
      `admin.users.role.${row.memberMarketplaceRole.toLowerCase()}`,
    );
    const status = this.translate.instant(`admin.users.status.${row.memberStatus.toLowerCase()}`);
    return `${role} · ${status}`;
  }

  protected onSearchInput(event: Event): void {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  protected selectFilter(filterId: AdminMessageThreadFilter): void {
    this.store.dispatch(AdminMessagesActions.setMessageThreadFilter({ filter: filterId }));
  }

  protected retryQueue(): void {
    this.store.dispatch(AdminMessagesActions.loadMessageThreads());
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.store.dispatch(AdminMessagesActions.setMessageThreadPage({ page }));
  }

  // ── Thread selection ──
  protected openThread(thread: AdminMessageThread): void {
    this.store.dispatch(
      AdminMessagesActions.selectMessageThread({ conversationId: thread.conversationId }),
    );
  }

  protected closeThread(): void {
    this.store.dispatch(AdminMessagesActions.clearSelectedMessageThread());
  }

  protected retryDetail(): void {
    const id = this.selectedThreadId();
    if (id === null) return;
    this.store.dispatch(AdminMessagesActions.selectMessageThread({ conversationId: id }));
  }

  protected isNote(message: ChatMessage): boolean {
    return message.type === 'moderationNote';
  }

  // ── Composer ──
  protected onComposerInput(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected send(): void {
    const conversationId = this.selectedThreadId();
    const content = this.draft().trim();
    if (conversationId === null || content.length === 0 || this.sending()) return;
    this.store.dispatch(AdminMessagesActions.sendMessageThreadMessage({ conversationId, content }));
    this.draft.set('');
  }

  // ── Profile dialog ──
  protected openProfile(userId: string): void {
    this.store.dispatch(AdminUsersActions.loadAdminUserLookup({ userId }));
  }

  protected closeProfile(): void {
    this.store.dispatch(AdminUsersActions.clearAdminUserLookup());
  }

  protected retryProfile(): void {
    const id = this.profileUserId();
    if (id === null) return;
    this.store.dispatch(AdminUsersActions.loadAdminUserLookup({ userId: id }));
  }

  protected verifyProfile(): void {
    const id = this.profileUserId();
    if (id === null) return;
    this.store.dispatch(AdminUsersActions.verifyUser({ userId: id }));
  }

  protected suspendProfile(): void {
    const user = this.profileUser();
    if (user === null || !this.profileCanSuspend()) return;
    this.store.dispatch(AdminUsersActions.suspendUser({ userId: user.id }));
  }

  protected reactivateProfile(): void {
    const id = this.profileUserId();
    if (id === null) return;
    this.store.dispatch(AdminUsersActions.reactivateUser({ userId: id }));
  }

  protected viewReportsForProfile(userId: string): void {
    this.closeProfile();
    void this.router.navigate(['/admin/reports'], { queryParams: { userId } });
  }
}
