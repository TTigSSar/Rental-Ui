import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import en from '../../../../../../public/i18n/en.json';
import hy from '../../../../../../public/i18n/hy.json';
import ru from '../../../../../../public/i18n/ru.json';
import { AuthRedirectService } from '../../../auth/services/auth-redirect.service';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState } from '../../../auth/store/auth.state';
import { infoRoutes } from '../../routes';
import {
  ACCOUNT_DELETION_RETURN_URL,
  AccountDeletionPageComponent,
} from './account-deletion-page.component';

describe('AccountDeletionPageComponent (AD-4)', () => {
  let fixture: ComponentFixture<AccountDeletionPageComponent>;
  let translate: TranslateService;
  let store: MockStore;

  const el = () => fixture.nativeElement as HTMLElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setup(isAuthenticated: boolean): void {
    TestBed.configureTestingModule({
      imports: [AccountDeletionPageComponent],
      providers: [
        provideRouter([]),
        provideMockStore({
          initialState: { [authFeatureKey]: { ...initialAuthState, isAuthenticated } },
        }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
      ],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.setTranslation('ru', ru);
    translate.setTranslation('hy', hy);
    translate.use('en');
    store = TestBed.inject(MockStore);
    fixture = TestBed.createComponent(AccountDeletionPageComponent);
  }

  afterEach(() => {
    document.querySelectorAll('.p-dialog-mask').forEach((n) => n.remove());
  });

  it('renders for a guest, with no auth required', async () => {
    setup(false);
    await settle();

    expect(el().querySelector('h1')?.textContent).toContain('Delete your DoRent account');
    expect(el().querySelectorAll('.acc-del__step').length).toBe(3);
    expect(el().textContent).toContain('Erased');
    expect(el().textContent).toContain('Kept, anonymized');
    expect(el().textContent).toContain('reviews stay public');
    expect(el().textContent).toContain('Sign in and delete');
  });

  it.each([
    ['ru', 'Удаление аккаунта DoRent'],
    ['hy', 'Ջնջեք ձեր DoRent հաշիվը'],
  ])('switches to %s', async (lang, title) => {
    setup(false);
    translate.use(lang);
    await settle();

    expect(el().querySelector('h1')?.textContent).toContain(title);
  });

  it('is a public route (no guard)', () => {
    const route = infoRoutes.find((r) => r.path === 'account-deletion');
    expect(route).toBeDefined();
    expect(route?.canActivate).toBeUndefined();
  });

  it('stores /profile/settings as the return URL and opens sign-in for a guest', async () => {
    setup(false);
    const redirect = TestBed.inject(AuthRedirectService);
    await settle();

    el().querySelector<HTMLButtonElement>('[data-testid="account-deletion-cta"]')!.click();
    await settle();

    expect(ACCOUNT_DELETION_RETURN_URL).toBe('/profile/settings');
    expect(redirect.consume()).toBe('/profile/settings');
    expect(fixture.componentInstance['showAuthDialog']()).toBe(true);
  });

  it('goes straight to Settings when already signed in', async () => {
    setup(true);
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await settle();

    el().querySelector<HTMLButtonElement>('[data-testid="account-deletion-cta"]')!.click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/profile/settings');
    expect(fixture.componentInstance['showAuthDialog']()).toBe(false);
    expect(store).toBeTruthy();
  });
});
