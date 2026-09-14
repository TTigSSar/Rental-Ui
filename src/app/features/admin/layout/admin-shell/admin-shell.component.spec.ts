import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import * as AuthActions from '../../../auth/store/auth.actions';
import { makeAdminMessageThread, makeAdminOverview } from '../../../../../testing/fixtures';
import { adminMessagesFeatureKey } from '../../store/admin-messages.reducer';
import {
  initialAdminMessagesState,
  type AdminMessagesState,
} from '../../store/admin-messages.state';
import { adminModerationFeatureKey } from '../../store/admin-moderation.reducer';
import { initialAdminModerationState } from '../../store/admin-moderation.state';
import { adminOverviewFeatureKey } from '../../store/admin-overview.reducer';
import {
  initialAdminOverviewState,
  type AdminOverviewState,
} from '../../store/admin-overview.state';
import { AdminShellComponent } from './admin-shell.component';

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

function createFixture(
  adminModerationOverrides: Partial<typeof initialAdminModerationState> = {},
  adminOverviewOverrides: Partial<AdminOverviewState> = {},
  adminMessagesOverrides: Partial<AdminMessagesState> = {},
): ComponentFixture<AdminShellComponent> {
  TestBed.configureTestingModule({
    imports: [AdminShellComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        initialState: {
          [adminModerationFeatureKey]: {
            ...initialAdminModerationState,
            ...adminModerationOverrides,
          },
          [adminOverviewFeatureKey]: {
            ...initialAdminOverviewState,
            ...adminOverviewOverrides,
          },
          [adminMessagesFeatureKey]: {
            ...initialAdminMessagesState,
            ...adminMessagesOverrides,
          },
        },
      }),
    ],
  });
  return TestBed.createComponent(AdminShellComponent);
}

describe('AdminShellComponent — responsive branch selection', () => {
  it('renders the desktop topbar + rail chrome at ≥961px', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.admin-topbar')).not.toBeNull();
    expect(host.querySelector('.admin-rail')).not.toBeNull();
    expect(host.querySelector('.admin-mobile-header')).toBeNull();
    expect(host.querySelector('.admin-mobile-nav')).toBeNull();
  });

  it('renders the mobile header + bottom nav chrome at <961px', () => {
    mockMatchMedia(false);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.admin-mobile-header')).not.toBeNull();
    expect(host.querySelector('.admin-mobile-nav')).not.toBeNull();
    expect(host.querySelector('.admin-topbar')).toBeNull();
    expect(host.querySelector('.admin-rail')).toBeNull();
  });

  it('flips branch on window resize', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.admin-topbar')).not.toBeNull();

    mockMatchMedia(false);
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.admin-topbar')).toBeNull();
    expect(fixture.nativeElement.querySelector('.admin-mobile-header')).not.toBeNull();
  });

  it('renders all six nav destinations on desktop', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.admin-rail__link');
    expect(links.length).toBe(6);
  });

  it('renders all six nav destinations on mobile, one per bottom-nav column (no wrap)', () => {
    mockMatchMedia(false);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const nav = host.querySelector<HTMLElement>('.admin-mobile-nav');
    const items = host.querySelectorAll('.admin-mobile-nav__item');
    expect(items.length).toBe(6);
    // The grid's column count is driven by `--admin-mobile-nav-count`, set from
    // `navItems.length` — not a hardcoded `repeat(N, 1fr)` — so it tracks the real
    // number of destinations and can't silently drift out of sync again (see the
    // six-tab wrap regression this test guards against).
    expect(nav?.style.getPropertyValue('--admin-mobile-nav-count').trim()).toBe(
      String(fixture.componentInstance['navItems'].length),
    );
  });

  it('renders a loading-skeleton (not a hardcoded number) for nav counts and queue health while queue/overview/messages are all loading', () => {
    mockMatchMedia(true);
    const fixture = createFixture({ isLoading: true }, {}, { isLoading: true });
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    // Only Review/Categories/Messages/Reports show a meta value at all (Overview and
    // Users have none, matching the design) — Review/Messages are mid-load (their own
    // slices) and Categories/Reports depend on the still-unloaded adminOverview slice
    // (default state: overview === null).
    expect(host.querySelectorAll('.admin-rail__meta-skeleton').length).toBe(4);
    expect(host.querySelectorAll('.admin-rail__queue-health-skeleton').length).toBe(3);
  });

  it('shows the true unread total (counts.unread, not a sum over the loaded page) once the Messages queue has finished loading', () => {
    mockMatchMedia(true);
    const fixture = createFixture(
      {},
      {},
      {
        isLoading: false,
        // Only 2 rows loaded, but `counts.unread` is the server's true total across every
        // thread the admin has — the badge must read that, not sum `items`.
        items: [
          makeAdminMessageThread({ conversationId: 'c1', unreadCount: 2 }),
          makeAdminMessageThread({ conversationId: 'c2', unreadCount: 1 }),
        ],
        counts: { all: 40, unread: 17, needsReply: 5 },
      },
    );
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const messagesLink = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('.admin-rail__link'),
    ).find((link) => link.getAttribute('href') === '/admin/messages');
    expect(messagesLink?.querySelector('.admin-rail__meta--badge')?.textContent?.trim()).toBe(
      '17',
    );
  });

  it('dispatches loadMessageThreads() once per shell mount', () => {
    mockMatchMedia(true);
    TestBed.configureTestingModule({
      imports: [AdminShellComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: {
            [adminModerationFeatureKey]: initialAdminModerationState,
            [adminOverviewFeatureKey]: initialAdminOverviewState,
            [adminMessagesFeatureKey]: initialAdminMessagesState,
          },
        }),
      ],
    });
    const store = TestBed.inject(MockStore);
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[Admin Messages] Load Message Threads' }),
    );
  });

  it('shows the live review count once the queue has finished loading', () => {
    mockMatchMedia(true);
    const fixture = createFixture({
      isLoading: false,
      counts: { pending: 4, approved: 0, rejected: 0 },
    });
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const reviewLink = Array.from(
      host.querySelectorAll<HTMLAnchorElement>('.admin-rail__link'),
    ).find((link) => link.getAttribute('href') === '/admin/review');
    expect(reviewLink?.querySelector('.admin-rail__meta--badge')?.textContent?.trim()).toBe('4');
  });

  it('shows the live categories/reports counts once the overview has loaded', () => {
    mockMatchMedia(true);
    const fixture = createFixture(
      {},
      { overview: makeAdminOverview({ categoryCount: 10, openReportCount: 2 }) },
    );
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.admin-rail__link'));
    const categoriesLink = links.find((link) => link.getAttribute('href') === '/admin/categories');
    const reportsLink = links.find((link) => link.getAttribute('href') === '/admin/reports');
    expect(categoriesLink?.querySelector('.admin-rail__meta')?.textContent?.trim()).toBe('10');
    expect(reportsLink?.querySelector('.admin-rail__meta--badge')?.textContent?.trim()).toBe('2');
  });

  it('converts the real average-review-time to hours (rounded to one decimal) once the overview has loaded', () => {
    mockMatchMedia(true);
    const fixture = createFixture(
      {},
      { overview: makeAdminOverview({ averageReviewTimeMinutes: 192 }) },
    );
    fixture.detectChanges();

    // 192 minutes / 60 = 3.2h.
    const queueHealth = fixture.componentInstance['queueHealth']();
    expect(queueHealth.avgReviewHours).toBe(3.2);
    expect(queueHealth.hasAvgReviewData).toBe(true);
  });

  it('shows a dash (not the skeleton) when averageReviewTimeMinutes is null — "no data yet", not "0 minutes"', () => {
    mockMatchMedia(true);
    const fixture = createFixture(
      {},
      { overview: makeAdminOverview({ averageReviewTimeMinutes: null }) },
    );
    fixture.detectChanges();
    const queueHealth = fixture.componentInstance['queueHealth']();
    expect(queueHealth.avgReviewHours).toBeNull();
    expect(queueHealth.hasAvgReviewData).toBe(false);

    // The dd cell renders a dash, not the eternally-pulsing skeleton, once overview has loaded
    // but there's genuinely nothing to show.
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll('.admin-rail__queue-health-row');
    expect(rows[1].querySelector('dd')?.textContent?.trim()).toBe('—');
    expect(rows[1].querySelector('.admin-rail__queue-health-skeleton')).toBeNull();
  });

  it('keeps a real 0 as 0 (not the "no data" dash) for averageReviewTimeMinutes', () => {
    mockMatchMedia(true);
    const fixture = createFixture(
      {},
      { overview: makeAdminOverview({ averageReviewTimeMinutes: 0 }) },
    );
    fixture.detectChanges();
    const queueHealth = fixture.componentInstance['queueHealth']();
    expect(queueHealth.avgReviewHours).toBe(0);
    expect(queueHealth.hasAvgReviewData).toBe(true);
  });
});

describe('AdminShellComponent — account menu (ADR-016 §1 follow-up)', () => {
  // The topbar/mobile-header user chip is the only way a moderator can reach
  // Profile, get back to the member-facing site, or log out while under
  // `/admin/**` — the global header/footer that carry those everywhere else
  // are suppressed there (see `isAdminConsolePage()` in `app.ts`).

  it('turns the desktop chip into a real, labelled popup-menu trigger', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const trigger = host.querySelector<HTMLButtonElement>('.admin-topbar__user');
    expect(trigger?.tagName).toBe('BUTTON');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  it('adds an avatar trigger to the mobile header action slot, alongside where a projected action would sit', () => {
    mockMatchMedia(false);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const action = host.querySelector('.admin-mobile-header__action');
    const trigger = action?.querySelector<HTMLButtonElement>('.admin-mobile-header__account');
    expect(trigger?.tagName).toBe('BUTTON');
    expect(trigger?.getAttribute('aria-haspopup')).toBe('true');
  });

  it('opens the popup menu with Profile / Back to site / Log out when the desktop trigger is clicked', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const trigger = host.querySelector<HTMLButtonElement>('.admin-topbar__user');
    trigger?.click();
    fixture.detectChanges();

    // `p-menu`'s popup portals to `document.body` via `appendTo="body"` — not
    // `fixture.nativeElement` — same reasoning as `location-picker`'s
    // `p-dialog` usage (see that spec's identical comment).
    const items = document.body.querySelectorAll('.p-menu-item-content');
    expect(items.length).toBe(3);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('opens the same popup menu from the mobile trigger', () => {
    mockMatchMedia(false);
    const fixture = createFixture();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const trigger = host.querySelector<HTMLButtonElement>('.admin-mobile-header__account');
    trigger?.click();
    fixture.detectChanges();

    expect(document.body.querySelectorAll('.p-menu-item-content').length).toBe(3);
  });

  it('dispatches AuthActions.logout() — the same action the profile page dispatches — when Log out is activated', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const store = TestBed.inject(MockStore);
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    const host: HTMLElement = fixture.nativeElement;
    const trigger = host.querySelector<HTMLButtonElement>('.admin-topbar__user');
    trigger?.click();
    fixture.detectChanges();

    const items = document.body.querySelectorAll<HTMLElement>('.p-menu-item-content');
    // Model order is [Profile, Back to site, Log out] — the separator between
    // "Back to site" and "Log out" doesn't render its own itemContent.
    items[items.length - 1].click();

    expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout());
  });

  it('builds Profile and Back-to-site as routerLink items (not commands) to /profile and /', () => {
    mockMatchMedia(true);
    const fixture = createFixture();
    fixture.detectChanges();

    const items = fixture.componentInstance['accountMenuItems']();
    expect(items[0].routerLink).toBe('/profile');
    expect(items[1].routerLink).toBe('/');
    expect(items[2].separator).toBe(true);
    expect(typeof items[3].command).toBe('function');
  });
});
