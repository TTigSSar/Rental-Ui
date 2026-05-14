import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, filter, map } from 'rxjs';

import * as AuthActions from './features/auth/store/auth.actions';
import {
  selectAuthLoading,
  selectAuthUser,
  selectIsAuthenticated,
} from './features/auth/store/auth.selectors';
import { AvatarComponent } from './shared/ui/avatar/avatar.component';

interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly exactMatch: boolean;
}

interface LanguageOption {
  readonly code: 'en' | 'ru' | 'hy';
  readonly label: string;
  readonly shortLabel: string;
}

interface AppShellViewModel {
  readonly primaryNav: NavItem[];
  readonly isAuthenticated: boolean;
  /** `true` only when auth state has definitively settled as unauthenticated. */
  readonly isGuest: boolean;
  /** `true` while `/auth/me` is hydrating and we don't yet know if the user is logged in. */
  readonly isAuthPending: boolean;
  readonly userDisplayName: string | null;
  readonly userEmail: string | null;
}

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';
const SCROLL_SHRINK_THRESHOLD = 8;

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    AvatarComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  /** Shown in the authenticated user menu (desktop dropdown + mobile drawer). */
  protected readonly accountMenuItems: readonly NavItem[] = [
    { path: '/profile', labelKey: 'app.shell.nav.profile', exactMatch: false },
  ];

  protected readonly availableLanguages: readonly LanguageOption[] = [
    { code: 'en', label: 'English', shortLabel: 'EN' },
    { code: 'ru', label: 'Русский', shortLabel: 'RU' },
    { code: 'hy', label: 'Հայերեն', shortLabel: 'HY' },
  ];

  protected readonly mobileNavOpen = signal(false);
  protected readonly userMenuOpen = signal(false);
  protected readonly languageMenuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly currentLang = signal<LanguageOption>(this.availableLanguages[0]);

  private readonly userMenuHost = viewChild<ElementRef<HTMLElement>>('userMenuHost');
  private readonly mobileNavHost = viewChild<ElementRef<HTMLElement>>('mobileNavHost');
  private readonly languageMenuHost = viewChild<ElementRef<HTMLElement>>('languageMenuHost');

  protected readonly vm$ = combineLatest({
    isAuthenticated: this.store.select(selectIsAuthenticated),
    isAuthLoading: this.store.select(selectAuthLoading),
    user: this.store.select(selectAuthUser),
  }).pipe(
    map(({ isAuthenticated, isAuthLoading, user }): AppShellViewModel => {
      const isAdmin = user?.roles.includes('Admin') ?? false;

      const primaryNav: NavItem[] = [];

      if (isAuthenticated) {
        primaryNav.push(
          {
            path: '/my-listings',
            labelKey: 'app.shell.nav.myListings',
            exactMatch: false,
          },
          {
            path: '/bookings',
            labelKey: 'app.shell.nav.bookings',
            exactMatch: true,
          },
          {
            path: '/bookings/requests',
            labelKey: 'app.shell.nav.bookingRequests',
            exactMatch: false,
          },
        );
      }

      if (isAuthenticated && isAdmin) {
        primaryNav.push({
          path: '/admin/listings/pending',
          labelKey: 'app.shell.nav.pendingModeration',
          exactMatch: false,
        });
      }

      const isAuthPending = isAuthLoading && !isAuthenticated;
      const isGuest = !isAuthenticated && !isAuthLoading;

      return {
        primaryNav,
        isAuthenticated,
        isGuest,
        isAuthPending,
        userDisplayName:
          user === null ? null : `${user.firstName} ${user.lastName}`.trim(),
        userEmail: user?.email ?? null,
      };
    }),
  );

  constructor() {
    this.hydrateLanguage();

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.mobileNavOpen.set(false);
        this.userMenuOpen.set(false);
        this.languageMenuOpen.set(false);
      });
  }

  protected toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
    this.userMenuOpen.set(false);
    this.languageMenuOpen.set(false);
  }

  protected closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  protected toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
    this.mobileNavOpen.set(false);
    this.languageMenuOpen.set(false);
  }

  protected closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  protected toggleLanguageMenu(): void {
    this.languageMenuOpen.update((open) => !open);
    this.userMenuOpen.set(false);
  }

  protected selectLanguage(option: LanguageOption): void {
    this.currentLang.set(option);
    this.translate.use(option.code);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code);
    } catch {
      /* localStorage may be unavailable (SSR / privacy mode); safe to ignore. */
    }
    this.languageMenuOpen.set(false);
    this.mobileNavOpen.set(false);
  }

  protected logout(): void {
    this.store.dispatch(AuthActions.logout());
    this.userMenuOpen.set(false);
    this.mobileNavOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target === null) {
      return;
    }

    const userHost = this.userMenuHost()?.nativeElement;
    if (userHost !== undefined && !userHost.contains(target)) {
      this.userMenuOpen.set(false);
    }

    const mobileHost = this.mobileNavHost()?.nativeElement;
    if (mobileHost !== undefined && !mobileHost.contains(target)) {
      this.mobileNavOpen.set(false);
    }

    const langHost = this.languageMenuHost()?.nativeElement;
    if (langHost !== undefined && !langHost.contains(target)) {
      this.languageMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.mobileNavOpen.set(false);
      this.userMenuOpen.set(false);
      this.languageMenuOpen.set(false);
    }
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    const nextScrolled = window.scrollY > SCROLL_SHRINK_THRESHOLD;
    if (nextScrolled !== this.scrolled()) {
      this.scrolled.set(nextScrolled);
    }
  }

  private hydrateLanguage(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      stored = null;
    }

    const match =
      this.availableLanguages.find((lang) => lang.code === stored) ??
      this.availableLanguages[0];

    this.currentLang.set(match);
    if (stored !== null && stored === match.code) {
      this.translate.use(match.code);
    }
  }
}
