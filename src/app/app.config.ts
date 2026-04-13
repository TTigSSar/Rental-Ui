import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore, provideState } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';

import { AdminModerationEffects } from './features/admin/store/admin-moderation.effects';
import {
  adminModerationFeatureKey,
  adminModerationReducer,
} from './features/admin/store/admin-moderation.reducer';
import { AuthEffects } from './features/auth/store/auth.effects';
import { authInterceptor } from './features/auth/services/auth.interceptor';
import { authFeatureKey, authReducer } from './features/auth/store/auth.reducer';
import { BookingsEffects } from './features/bookings/store/bookings.effects';
import { bookingsFeatureKey, bookingsReducer } from './features/bookings/store/bookings.reducer';
import { ListingsEffects } from './features/listings/store/listings.effects';
import { listingsFeatureKey, listingsReducer } from './features/listings/store/listings.reducer';
import { MyListingsEffects } from './features/my-listings/store/my-listings.effects';
import {
  myListingsFeatureKey,
  myListingsReducer,
} from './features/my-listings/store/my-listings.reducer';
import { ProfileEffects } from './features/profile/store/profile.effects';
import { profileFeatureKey, profileReducer } from './features/profile/store/profile.reducer';
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
    provideState(adminModerationFeatureKey, adminModerationReducer),
    provideState(authFeatureKey, authReducer),
    provideState(bookingsFeatureKey, bookingsReducer),
    provideState(listingsFeatureKey, listingsReducer),
    provideState(myListingsFeatureKey, myListingsReducer),
    provideState(profileFeatureKey, profileReducer),
    provideEffects(AdminModerationEffects),
    provideEffects(AuthEffects),
    provideEffects(BookingsEffects),
    provideEffects(ListingsEffects),
    provideEffects(MyListingsEffects),
    provideEffects(ProfileEffects),
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
  ],
};
