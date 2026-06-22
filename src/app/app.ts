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

import * as AuthActions from './features/auth/store/auth.actions';
import {
  selectAuthInitializing,
  selectAuthUser,
  selectIsAuthenticated,
} from './features/auth/store/auth.selectors';
import { AuthDialogComponent } from './features/auth/components/auth-dialog/auth-dialog.component';
import { ListingsFiltersComponent } from './features/listings/components/listings-filters/listings-filters.component';
import type { ListingsFilter } from './features/listings/models/listings-filter.model';

interface NavItem {
  readonly path: string;
  readonly labelKey: string;
  readonly exactMatch: boolean;
}

interface LanguageOption {
  readonly code: 'en' | 'hy' | 'ru';
  readonly label: string;
}

const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'hy', label: 'Հայերեն' },
  { code: 'ru', label: 'Русский' },
];

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

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';
const SCROLL_SHRINK_THRESHOLD = 8;

function isListingDetailsUrl(url: string): boolean {
  const path = url.split('?')[0];
  return /^\/listings\/(?!create$)[^/]+$/.test(path);
}

function isListingsBrowseUrl(url: string): boolean {
  return url.split('?')[0] === '/listings';
}

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    AuthDialogComponent,
    ListingsFiltersComponent,
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
  protected readonly notifPanelOpen   = signal(false);
  protected readonly unreadNotifCount  = signal(0);
  protected readonly scrolled          = signal(false);
  protected readonly showFooter        = signal(!isListingDetailsUrl(this.router.url));
  protected readonly isBrowsePage      = signal(isListingsBrowseUrl(this.router.url));
  protected readonly isDetailsPage     = signal(isListingDetailsUrl(this.router.url));
  protected readonly showAuthDialog    = signal(false);
  protected readonly authDialogMode    = signal<'login' | 'register'>('login');
  protected readonly langMenuOpen      = signal(false);
  protected readonly languages         = LANGUAGES;
  protected readonly currentLang       = signal<LanguageOption>(this.resolveCurrentLang());

  private readonly notifMenuHost  = viewChild<ElementRef<HTMLElement>>('notifMenuHost');
  private readonly langMenuHost   = viewChild<ElementRef<HTMLElement>>('langMenuHost');

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
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.notifPanelOpen.set(false);
      });

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
      });
  }

  protected openAuthDialog(mode: 'login' | 'register'): void {
    this.authDialogMode.set(mode);
    this.showAuthDialog.set(true);
  }

  protected onBrowseFiltersChanged(filters: ListingsFilter): void {
    void this.router.navigate(['/listings'], {
      queryParams: {
        q: filters.query || null,
        city: filters.city || null,
        categoryId: filters.categoryId || null,
        minPrice: filters.minPrice ?? null,
        maxPrice: filters.maxPrice ?? null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleNotifPanel(): void {
    this.notifPanelOpen.update((open) => !open);
  }

  protected toggleLangMenu(): void {
    this.langMenuOpen.update((open) => !open);
  }

  protected selectLanguage(option: LanguageOption): void {
    this.currentLang.set(option);
    this.translate.use(option.code);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code); } catch { /* ignore */ }
    this.langMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target === null) return;

    const notifHost = this.notifMenuHost()?.nativeElement;
    if (notifHost !== undefined && !notifHost.contains(target)) {
      this.notifPanelOpen.set(false);
    }

    const langHost = this.langMenuHost()?.nativeElement;
    if (langHost !== undefined && !langHost.contains(target)) {
      this.langMenuOpen.set(false);
    }
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    const nextScrolled = window.scrollY > SCROLL_SHRINK_THRESHOLD;
    if (nextScrolled !== this.scrolled()) {
      this.scrolled.set(nextScrolled);
    }
  }

  private resolveCurrentLang(): LanguageOption {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* ignore */ }
    return LANGUAGES.find((l) => l.code === stored) ?? LANGUAGES[0];
  }

  private hydrateLanguage(): void {
    const lang = this.resolveCurrentLang();
    this.translate.use(lang.code);
  }
}
