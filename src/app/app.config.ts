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

import { AdminModerationEffects } from './features/admin/store/admin-moderation.effects';
import { HomeEffects } from './features/home/store/home.effects';
import { homeFeatureKey, homeReducer } from './features/home/store/home.reducer';
import {
  adminModerationFeatureKey,
  adminModerationReducer,
} from './features/admin/store/admin-moderation.reducer';
import { AuthEffects } from './features/auth/store/auth.effects';
import { authInterceptor } from './features/auth/services/auth.interceptor';
import { authFeatureKey, authReducer } from './features/auth/store/auth.reducer';
import { BookingsEffects } from './features/bookings/store/bookings.effects';
import { bookingsFeatureKey, bookingsReducer } from './features/bookings/store/bookings.reducer';
import { ChatEffects } from './features/chat/store/chat.effects';
import { chatFeatureKey, chatReducer } from './features/chat/store/chat.reducer';
import { FavoritesEffects } from './features/favorites/store/favorites.effects';
import {
  favoritesFeatureKey,
  favoritesReducer,
} from './features/favorites/store/favorites.reducer';
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
    provideState(homeFeatureKey, homeReducer),
    provideState(authFeatureKey, authReducer),
    provideState(bookingsFeatureKey, bookingsReducer),
    provideState(chatFeatureKey, chatReducer),
    provideState(favoritesFeatureKey, favoritesReducer),
    provideState(listingsFeatureKey, listingsReducer),
    provideState(myListingsFeatureKey, myListingsReducer),
    provideState(profileFeatureKey, profileReducer),
    provideEffects(AdminModerationEffects),
    provideEffects(HomeEffects),
    provideEffects(AuthEffects),
    provideEffects(BookingsEffects),
    provideEffects(ChatEffects),
    provideEffects(FavoritesEffects),
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
    MessageService,
  ],
};
