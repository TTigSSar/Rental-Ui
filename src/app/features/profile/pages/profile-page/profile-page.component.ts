import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, filter, map, of, startWith, switchMap } from 'rxjs';

import { IconComponent } from '../../../../shared/ui/icon/icon.component';

import * as AuthActions from '../../../auth/store/auth.actions';
import * as BookingsActions from '../../../bookings/store/bookings.actions';
import * as FavoritesActions from '../../../favorites/store/favorites.actions';
import * as MyListingsActions from '../../../my-listings/store/my-listings.actions';
import { RatingSummaryComponent } from '../../../reviews/components/rating-summary/rating-summary.component';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import type { RatingSummaryView } from '../../../reviews/components/rating-summary/rating-summary.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectOwnerReviews,
  selectOwnerReviewsError,
  selectOwnerReviewsLoading,
} from '../../../reviews/store/reviews.selectors';
import {
  selectBookingRequests,
  selectMyBookings,
} from '../../../bookings/store/bookings.selectors';
import { selectFavoriteItems } from '../../../favorites/store/favorites.selectors';
import { selectMyListingsItems } from '../../../my-listings/store/my-listings.selectors';
import * as ProfileActions from '../../store/profile.actions';
import {
  selectProfile,
  selectProfileError,
  selectProfileLoading,
} from '../../store/profile.selectors';

interface LanguageOption {
  readonly code: 'en' | 'ru' | 'hy';
  readonly label: string;
}

const LANGUAGE_STORAGE_KEY = 'stayfinder.lang';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    AsyncPipe,
    IconComponent,
    MessageModule,
    RatingSummaryComponent,
    ReviewCardComponent,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SkeletonModule,
    TranslatePipe,
  ],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isChildRouteActive = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      startWith(null),
      map(() => this.activatedRoute.firstChild !== null),
    ),
    { initialValue: false },
  );

  protected readonly availableLanguages: readonly LanguageOption[] = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'hy', label: 'Հայերեն' },
  ];

  protected readonly languageMenuOpen = signal(false);
  protected readonly currentLang = signal<LanguageOption>(this.resolveCurrentLang());

  private readonly profileId$ = this.store.select(selectProfile).pipe(
    map((p) => p?.id ?? null),
    distinctUntilChanged(),
  );

  private readonly profileIdSignal = toSignal(this.profileId$, {
    initialValue: null,
  });

  private readonly ownerSummary = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviews(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly reviews = computed(() => this.ownerSummary()?.comments ?? []);

  protected readonly reviewsLoading = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviewsLoading(id)) : of(false),
      ),
    ),
    { initialValue: false },
  );

  protected readonly reviewsError = toSignal(
    this.profileId$.pipe(
      switchMap((id) =>
        id ? this.store.select(selectOwnerReviewsError(id)) : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly ratingSummary = computed((): RatingSummaryView | null => {
    const s = this.ownerSummary();
    return s ? { average: s.overallAverage, reviewCount: s.reviewCount, hasAggregate: s.hasAggregate } : null;
  });

  // Sidebar stats from real store data
  protected readonly listingsCount = toSignal(
    this.store.select(selectMyListingsItems).pipe(map((items) => items.length)),
    { initialValue: 0 },
  );

  protected readonly rentalsCount = toSignal(
    this.store.select(selectMyBookings).pipe(map((bookings) => bookings.length)),
    { initialValue: 0 },
  );

  protected readonly pendingRequestsCount = toSignal(
    this.store.select(selectBookingRequests).pipe(
      map((reqs) => reqs.filter((r) => r.status === 'Pending' || r.status === 'PendingApproval').length),
    ),
    { initialValue: 0 },
  );

  protected readonly favoritesCount = toSignal(
    this.store.select(selectFavoriteItems).pipe(map((items) => items.length)),
    { initialValue: 0 },
  );

  // Count active/approved bookings as "upcoming" for nav suffix
  protected readonly upcomingBookingsCount = toSignal(
    this.store.select(selectMyBookings).pipe(
      map((bookings) =>
        bookings.filter((b) =>
          b.status === 'Approved' || b.status === 'PendingApproval' || b.status === 'Active',
        ).length,
      ),
    ),
    { initialValue: 0 },
  );

  protected readonly liveListingsCount = toSignal(
    this.store.select(selectMyListingsItems).pipe(
      map((items) => items.filter((l) => l.status === 'Approved').length),
    ),
    { initialValue: 0 },
  );

  protected readonly activeBookingsCount = toSignal(
    this.store.select(selectMyBookings).pipe(
      map((bookings) => bookings.filter((b) => b.status === 'Active').length),
    ),
    { initialValue: 0 },
  );

  protected readonly upcomingOnlyCount = toSignal(
    this.store.select(selectMyBookings).pipe(
      map((bookings) => bookings.filter((b) => b.status === 'Approved').length),
    ),
    { initialValue: 0 },
  );

  protected readonly vm$ = combineLatest({
    profile: this.store.select(selectProfile),
    isLoading: this.store.select(selectProfileLoading),
    error: this.store.select(selectProfileError),
  }).pipe(
    map(({ profile, isLoading, error }) => ({
      profile,
      isLoading,
      error,
      showLoading: isLoading && profile === null,
      showEmpty: !isLoading && profile === null && error === null,
    })),
  );

  constructor() {
    effect(() => {
      const id = this.profileIdSignal();
      if (id !== null) {
        this.store.dispatch(ReviewsActions.loadOwnerReviews({ userId: id }));
      }
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ProfileActions.loadProfile());
    this.store.dispatch(MyListingsActions.loadMyListings());
    this.store.dispatch(BookingsActions.loadMyBookings());
    this.store.dispatch(BookingsActions.loadBookingRequests());
    this.store.dispatch(FavoritesActions.loadFavorites());
  }

  protected logout(): void {
    this.store.dispatch(AuthActions.logout());
  }

  protected toggleLanguageMenu(): void {
    this.languageMenuOpen.update((v) => !v);
  }

  protected selectLanguage(option: LanguageOption): void {
    this.currentLang.set(option);
    this.translate.use(option.code);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code);
    } catch { /* ignore */ }
    this.languageMenuOpen.set(false);
  }

  protected initials(firstName: string, lastName: string): string {
    return ((firstName[0] ?? '') + (lastName[0] ?? '')).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (target === null) return;
    if (!target.closest?.('[data-lang-section]')) {
      this.languageMenuOpen.set(false);
    }
  }

  private resolveCurrentLang(): LanguageOption {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* ignore */ }
    return this.availableLanguages.find((l) => l.code === stored) ?? this.availableLanguages[0];
  }
}
