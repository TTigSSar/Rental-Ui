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
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Toast } from 'primeng/toast';
import { combineLatest, filter, map } from 'rxjs';

import { AuthRedirectService } from './features/auth/services/auth-redirect.service';
import * as AuthActions from './features/auth/store/auth.actions';
import {
  selectAuthInitializing,
  selectAuthUser,
  selectIsAuthenticated,
} from './features/auth/store/auth.selectors';

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
  readonly isGuest: boolean;
  readonly isAuthPending: boolean;
  readonly isAdmin: boolean;
  readonly userDisplayName: string | null;
  readonly userEmail: string | null;
}

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';
const SCROLL_SHRINK_THRESHOLD = 8;

function isListingDetailsUrl(url: string): boolean {
  const path = url.split('?')[0];
  return /^\/listings\/(?!create$)[^/]+$/.test(path);
}

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslatePipe,
    Toast,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly authRedirect = inject(AuthRedirectService);

  protected readonly availableLanguages: readonly LanguageOption[] = [
    { code: 'en', label: 'English', shortLabel: 'EN' },
    { code: 'ru', label: 'Русский', shortLabel: 'RU' },
    { code: 'hy', label: 'Հայերեն', shortLabel: 'HY' },
  ];

  protected readonly languageMenuOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly currentLang = signal<LanguageOption>(this.availableLanguages[0]);
  protected readonly showFooter = signal(!isListingDetailsUrl(this.router.url));

  private readonly languageMenuHost = viewChild<ElementRef<HTMLElement>>('languageMenuHost');

  protected readonly vm$ = combineLatest({
    isAuthenticated: this.store.select(selectIsAuthenticated),
    isAuthInitializing: this.store.select(selectAuthInitializing),
    user: this.store.select(selectAuthUser),
  }).pipe(
    map(({ isAuthenticated, isAuthInitializing, user }): AppShellViewModel => {
      const isAdmin = user?.roles.includes('Admin') ?? false;

      const primaryNav: NavItem[] = [];

      if (isAuthenticated && isAdmin) {
        primaryNav.push({
          path: '/admin/listings/pending',
          labelKey: 'app.shell.nav.pendingModeration',
          exactMatch: false,
        });
      } else if (isAuthenticated) {
        primaryNav.push(
          {
            path: '/my-listings',
            labelKey: 'app.shell.nav.myListings',
            exactMatch: false,
          },
          {
            path: '/favorites',
            labelKey: 'app.shell.nav.favorites',
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

      const isAuthPending = isAuthInitializing;
      const isGuest = !isAuthenticated && !isAuthInitializing;

      return {
        primaryNav,
        isAuthenticated,
        isGuest,
        isAuthPending,
        isAdmin,
        userDisplayName:
          user === null ? null : `${user.firstName} ${user.lastName}`.trim(),
        userEmail: user?.email ?? null,
      };
    }),
  );

  constructor() {
    this.store.dispatch(AuthActions.authInitStarted());
    this.hydrateLanguage();

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.languageMenuOpen.set(false);
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.showFooter.set(!isListingDetailsUrl(event.urlAfterRedirects));
      });
  }

  protected toggleLanguageMenu(): void {
    this.languageMenuOpen.update((open) => !open);
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
  }

  /** Guest center FAB — preserve intended create-listing destination after auth. */
  protected onGuestListToyClick(): void {
    this.authRedirect.set('/listings/create');
    void this.router.navigate(['/auth/login']);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target === null) return;

    const langHost = this.languageMenuHost()?.nativeElement;
    if (langHost !== undefined && !langHost.contains(target)) {
      this.languageMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
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
