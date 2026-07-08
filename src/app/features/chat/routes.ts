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
    // ChatShellComponent is the persistent master-detail layout: the
    // conversations list lives in its left rail, the thread renders in the
    // right-pane <router-outlet>. On desktop both panes show side by side; on
    // mobile it collapses to a single column (list at /chat, thread at
    // /chat/:id) via CSS. See chat-shell.component.*.
    loadComponent: () =>
      import('./pages/chat-shell/chat-shell.component').then((m) => m.ChatShellComponent),
    children: [
      {
        path: ':conversationId',
        loadComponent: () =>
          import('./pages/conversation-details-page/conversation-details-page.component').then(
            (m) => m.ConversationDetailsPageComponent,
          ),
      },
    ],
  },
];
