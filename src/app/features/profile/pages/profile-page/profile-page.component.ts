import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { combineLatest, distinctUntilChanged, map, of, switchMap } from 'rxjs';

import * as AuthActions from '../../../auth/store/auth.actions';
import { RatingSummaryComponent } from '../../../reviews/components/rating-summary/rating-summary.component';
import { ReviewCardComponent } from '../../../reviews/components/review-card/review-card.component';
import type { RatingSummaryView } from '../../../reviews/components/rating-summary/rating-summary.component';
import * as ReviewsActions from '../../../reviews/store/reviews.actions';
import {
  selectOwnerReviews,
  selectOwnerReviewsError,
  selectOwnerReviewsLoading,
} from '../../../reviews/store/reviews.selectors';
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
    MessageModule,
    RatingSummaryComponent,
    ReviewCardComponent,
    RouterLink,
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

  protected readonly availableLanguages: readonly LanguageOption[] = [
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Русский' },
    { code: 'hy', label: 'Հայերեն' },
  ];

  protected readonly languageMenuOpen = signal(false);
  protected readonly currentLang = signal<LanguageOption>(this.resolveCurrentLang());

  private readonly langMenuHost = viewChild<ElementRef<HTMLElement>>('langMenuHost');

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
    const target = event.target as Node | null;
    if (target === null) return;
    const host = this.langMenuHost()?.nativeElement;
    if (host !== undefined && !host.contains(target)) {
      this.languageMenuOpen.set(false);
    }
  }

  private resolveCurrentLang(): LanguageOption {
    let stored: string | null = null;
    try { stored = localStorage.getItem(LANGUAGE_STORAGE_KEY); } catch { /* ignore */ }
    return this.availableLanguages.find((l) => l.code === stored) ?? this.availableLanguages[0];
  }
}
