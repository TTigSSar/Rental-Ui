import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map } from 'rxjs';

import * as AuthActions from './features/auth/store/auth.actions';
import {
  selectAuthUser,
  selectIsAuthenticated,
} from './features/auth/store/auth.selectors';

interface NavItem {
  readonly path: string;
  readonly labelKey: string;
}

interface AppShellViewModel {
  readonly primaryNav: NavItem[];
  readonly secondaryNav: NavItem[];
  readonly isAuthenticated: boolean;
  readonly userDisplayName: string | null;
}

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly store = inject(Store);

  private readonly guestSecondaryNav: readonly NavItem[] = [
    { path: '/auth/login', labelKey: 'app.shell.nav.login' },
    { path: '/auth/register', labelKey: 'app.shell.nav.register' },
  ];

  private readonly authSecondaryNavBase: readonly NavItem[] = [
    { path: '/profile', labelKey: 'app.shell.nav.profile' },
  ];

  protected readonly vm$ = combineLatest({
    isAuthenticated: this.store.select(selectIsAuthenticated),
    user: this.store.select(selectAuthUser),
  }).pipe(
    map(({ isAuthenticated, user }): AppShellViewModel => {
      const isOwner = user?.roles.some((role) =>
        ['Owner', 'Host', 'Admin'].includes(role),
      );

      const primaryNav: NavItem[] = [
        { path: '/listings', labelKey: 'app.shell.nav.listings' },
        { path: '/listings/favorites', labelKey: 'app.shell.nav.favorites' },
        { path: '/bookings', labelKey: 'app.shell.nav.bookings' },
      ];

      if (isAuthenticated && isOwner) {
        primaryNav.push(
          { path: '/my-listings', labelKey: 'app.shell.nav.myListings' },
          {
            path: '/bookings/requests',
            labelKey: 'app.shell.nav.bookingRequests',
          },
        );
      }

      return {
        primaryNav,
        secondaryNav: isAuthenticated
          ? [...this.authSecondaryNavBase]
          : [...this.guestSecondaryNav],
        isAuthenticated,
        userDisplayName:
          user === null ? null : `${user.firstName} ${user.lastName}`.trim(),
      };
    }),
  );

  protected logout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
