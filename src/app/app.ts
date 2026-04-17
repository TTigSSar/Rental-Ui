import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';

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

interface AppShellViewModel {
  readonly primaryNav: NavItem[];
  readonly secondaryNav: NavItem[];
  readonly isAuthenticated: boolean;
  readonly isAuthLoading: boolean;
  readonly userDisplayName: string | null;
}

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

  private readonly guestSecondaryNav: readonly NavItem[] = [
    { path: '/auth/login', labelKey: 'app.shell.nav.login', exactMatch: false },
    {
      path: '/auth/register',
      labelKey: 'app.shell.nav.register',
      exactMatch: false,
    },
  ];

  private readonly authSecondaryNavBase: readonly NavItem[] = [
    { path: '/profile', labelKey: 'app.shell.nav.profile', exactMatch: false },
  ];

  protected readonly vm$ = combineLatest({
    isAuthenticated: this.store.select(selectIsAuthenticated),
    isAuthLoading: this.store.select(selectAuthLoading),
    user: this.store.select(selectAuthUser),
  }).pipe(
    map(({ isAuthenticated, isAuthLoading, user }): AppShellViewModel => {
      const isAdmin = user?.roles.includes('Admin') ?? false;

      const primaryNav: NavItem[] = [
        { path: '/', labelKey: 'app.shell.nav.home', exactMatch: true },
        {
          path: '/listings',
          labelKey: 'app.shell.nav.listings',
          exactMatch: false,
        },
      ];

      if (isAuthenticated) {
        primaryNav.push(
          {
            path: '/favorites',
            labelKey: 'app.shell.nav.favorites',
            exactMatch: false,
          },
          { path: '/chat', labelKey: 'app.shell.nav.chat', exactMatch: false },
          {
            path: '/bookings',
            labelKey: 'app.shell.nav.bookings',
            exactMatch: true,
          },
          {
            path: '/my-listings',
            labelKey: 'app.shell.nav.myListings',
            exactMatch: false,
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

      return {
        primaryNav,
        secondaryNav: isAuthenticated
          ? [...this.authSecondaryNavBase]
          : [...this.guestSecondaryNav],
        isAuthenticated,
        isAuthLoading,
        userDisplayName:
          user === null ? null : `${user.firstName} ${user.lastName}`.trim(),
      };
    }),
  );

  protected logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
