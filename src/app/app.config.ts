import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MessageService } from 'primeng/api';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore, provideState } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';

import { AuthEffects } from './features/auth/store/auth.effects';
import { authInterceptor } from './features/auth/services/auth.interceptor';
import { authFeatureKey, authReducer } from './features/auth/store/auth.reducer';
import { routes } from './app.routes';

const translateHttpLoaderProviders = provideTranslateHttpLoader({
  prefix: '/i18n/',
  suffix: '.json',
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideStore(),
    // Auth is the only eagerly-registered slice: the app shell reads auth
    // state and dispatches authInitStarted at bootstrap. Every other feature
    // slice is registered lazily on the route(s) that consume it (see each
    // feature's routes.ts).
    provideState(authFeatureKey, authReducer),
    provideEffects(AuthEffects),
    translateHttpLoaderProviders[0],
    ...provideTranslateService({
      fallbackLang: 'en',
      lang: 'en',
      loader: translateHttpLoaderProviders[1],
    }),
    providePrimeNG({
      theme: {
        preset: Aura,
      },
    }),
    MessageService,
  ],
};
