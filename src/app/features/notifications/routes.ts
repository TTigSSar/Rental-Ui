import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { NotificationsEffects } from './store/notifications.effects';
import {
  notificationsFeatureKey,
  notificationsReducer,
} from './store/notifications.reducer';

export const notificationsRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [
      provideState(notificationsFeatureKey, notificationsReducer),
      provideEffects(NotificationsEffects),
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/notifications-page/notifications-page.component').then(
            (m) => m.NotificationsPageComponent,
          ),
      },
    ],
  },
];
