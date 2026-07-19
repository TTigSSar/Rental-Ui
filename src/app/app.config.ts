import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { MessageService } from 'primeng/api';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore, provideState } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { definePreset } from '@primeuix/themes';
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

/**
 * "Refined Warm" (Direction A) preset over Aura. Maps PrimeNG's `primary`
 * ramp + light color-scheme to the DoRent warm-orange tokens so components
 * we don't hand-style (datepicker focus/range, checkboxes, focus rings, etc.)
 * inherit the brand palette instead of Aura's default emerald/indigo.
 * Hex values mirror src/styles.css design tokens (prototype system.jsx TOKENS.A).
 */
const DoRentPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fff4ec',
      100: '#ffeedc',
      200: '#ffd9b8',
      300: '#ffbd8a',
      400: '#ff8f47',
      500: '#ff6008',
      600: '#e5530a',
      700: '#c2440a',
      800: '#9c360a',
      900: '#7e2f0c',
      950: '#451705',
    },
    focusRing: {
      width: '3px',
      style: 'solid',
      color: 'rgba(255, 96, 8, 0.45)',
      offset: '2px',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#ff6008',
          contrastColor: '#ffffff',
          hoverColor: '#e5530a',
          activeColor: '#c2440a',
        },
        highlight: {
          background: '#ffeedc',
          focusBackground: '#ffd9b8',
          color: '#9c360a',
          focusColor: '#7e2f0c',
        },
        content: {
          borderColor: '#e8e5de',
        },
        formField: {
          borderColor: '#e8e5de',
          focusBorderColor: '#ff6008',
        },
      },
    },
  },
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
        preset: DoRentPreset,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    MessageService,
  ],
};
