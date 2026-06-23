import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { adminGuard } from './guards/admin.guard';
import { AdminModerationEffects } from './store/admin-moderation.effects';
import { adminModerationFeatureKey, adminModerationReducer } from './store/admin-moderation.reducer';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    providers: [
      provideState(adminModerationFeatureKey, adminModerationReducer),
      provideEffects(AdminModerationEffects),
    ],
    children: [
      {
        path: 'listings/pending',
        loadComponent: () =>
          import('./pages/pending-listings-page/pending-listings-page.component').then(
            (m) => m.PendingListingsPageComponent,
          ),
      },
    ],
  },
];
