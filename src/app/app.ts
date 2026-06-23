import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Toast } from 'primeng/toast';
import { combineLatest, filter, map } from 'rxjs';

import * as AuthActions from './features/auth/store/auth.actions';
import {
  selectAuthInitializing,
  selectAuthUser,
  selectIsAuthenticated,
} from './features/auth/store/auth.selectors';
import { AuthDialogComponent } from './features/auth/components/auth-dialog/auth-dialog.component';
import { AppHeaderComponent } from './shared/ui/app-header/app-header.component';

interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly exactMatch: boolean;
}

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';
const VALID_LANG_CODES = ['en', 'hy', 'ru'] as const;
const SCROLL_SHRINK_THRESHOLD = 8;

interface AppShellViewModel {
  readonly primaryNav: NavItem[];
  readonly isAuthenticated: boolean;
  readonly isGuest: boolean;
  readonly isAuthPending: boolean;
  readonly isAdmin: boolean;
  readonly userDisplayName: string | null;
  readonly userEmail: string | null;
  readonly userInitials: string | null;
}

function isListingDetailsUrl(url: string): boolean {
  const path = url.split('?')[0];
  return /^\/listings\/(?!create$)[^/]+$/.test(path);
}

function isListingsBrowseUrl(url: string): boolean {
  return url.split('?')[0] === '/listings';
}

function isProfileChildUrl(url: string): boolean {
  const path = url.split('?')[0];
  return /^\/profile\/(toys|rentals|requests|saved)(\/.*)?$/.test(path);
}

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    AppHeaderComponent,
    AuthDialogComponent,
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

  protected readonly unreadNotifCount  = signal(0);
  protected readonly scrolled          = signal(false);
  protected readonly showFooter        = signal(!isListingDetailsUrl(this.router.url));
  protected readonly isBrowsePage      = signal(isListingsBrowseUrl(this.router.url));
  protected readonly isDetailsPage     = signal(isListingDetailsUrl(this.router.url));
  protected readonly isProfileChildPage = signal(isProfileChildUrl(this.router.url));
  protected readonly showAuthDialog    = signal(false);
  protected readonly authDialogMode    = signal<'login' | 'register'>('login');

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
        userInitials:
          user === null ? null : ((user.firstName?.[0] ?? '') + (user.lastName?.[0] ?? '')).toUpperCase() || null,
      };
    }),
  );

  constructor() {
    this.store.dispatch(AuthActions.authInitStarted());
    this.hydrateLanguage();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        const url = event.urlAfterRedirects;
        this.showFooter.set(!isListingDetailsUrl(url));
        this.isBrowsePage.set(isListingsBrowseUrl(url));
        this.isDetailsPage.set(isListingDetailsUrl(url));
        this.isProfileChildPage.set(isProfileChildUrl(url));
      });
  }

  protected openAuthDialog(mode: 'login' | 'register'): void {
    this.authDialogMode.set(mode);
    this.showAuthDialog.set(true);
  }

  protected onSignOut(): void {
    this.store.dispatch(AuthActions.logout());
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
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* ignore */ }
    const code = (VALID_LANG_CODES as readonly string[]).includes(stored ?? '') ? stored! : 'en';
    this.translate.use(code);
  }
}
