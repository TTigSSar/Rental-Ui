import type { Routes } from '@angular/router';

import { authGuard } from '../auth/guards/auth.guard';

export const chatRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/conversations-page/conversations-page.component').then(
            (m) => m.ConversationsPageComponent,
          ),
      },
      {
        path: ':conversationId',
        loadComponent: () =>
          import(
            './pages/conversation-details-page/conversation-details-page.component'
          ).then((m) => m.ConversationDetailsPageComponent),
      },
    ],
  },
];
