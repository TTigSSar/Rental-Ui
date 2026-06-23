import type { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';

import { authGuard } from '../auth/guards/auth.guard';
import { ChatEffects } from './store/chat.effects';
import { chatFeatureKey, chatReducer } from './store/chat.reducer';

export const chatRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [provideState(chatFeatureKey, chatReducer), provideEffects(ChatEffects)],
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
