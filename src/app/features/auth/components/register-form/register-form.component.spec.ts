import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { LanguageService } from '../../../../shared/services/language.service';
import * as AuthActions from '../../store/auth.actions';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState } from '../../store/auth.state';
import type { HomePointSelection } from '../../../../shared/ui/home-point-map/home-point-map.model';
import { RegisterFormComponent } from './register-form.component';

/**
 * Step 2 mounts `app-home-point-map`, which mounts a real `app-map` and its
 * dynamic `import('leaflet')`. These tests are about the two-step flow, not
 * Leaflet's rendering (covered by `map.component.spec.ts`), so the package is
 * stubbed the same way `location-picker.component.spec.ts` stubs it.
 */
vi.mock('leaflet', () => ({
  map: vi.fn((_el: HTMLElement, options: { center: [number, number] }) => ({
    setView: vi.fn(),
    on: vi.fn(),
    getCenter: vi.fn(() => ({ lat: options.center[0], lng: options.center[1] })),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  })),
  tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
  marker: vi.fn(() => ({ addTo: vi.fn() })),
  circle: vi.fn(() => ({ addTo: vi.fn() })),
  divIcon: vi.fn((options: unknown) => options),
}));

function authState(overrides: Partial<typeof initialAuthState> = {}) {
  return { [authFeatureKey]: { ...initialAuthState, ...overrides } };
}

function setup(stateOverrides: Partial<typeof initialAuthState> = {}): {
  fixture: ComponentFixture<RegisterFormComponent>;
  store: Store;
  mockStore: MockStore;
} {
  TestBed.configureTestingModule({
    imports: [RegisterFormComponent, TranslateModule.forRoot()],
    providers: [provideMockStore({ initialState: authState(stateOverrides) })],
  });
  const fixture = TestBed.createComponent(RegisterFormComponent);
  const store = TestBed.inject(Store);
  const mockStore = TestBed.inject(MockStore);
  fixture.detectChanges();
  return { fixture, store, mockStore };
}

function fillValidForm(component: RegisterFormComponent, password: string): void {
  component['registerForm'].setValue({
    firstName: 'Ann',
    lastName: 'Doe',
    email: 'ann@example.com',
    password,
    phoneNumber: '+37499123456',
  });
}

/**
 * `Store.dispatch` is overloaded (action, or a thunk-ish `() => Action`), so
 * TypeScript widens a spy's recorded arguments to the union and `.type` is not
 * on it. Narrowing once here keeps the assertions readable.
 */
type DispatchSpy = { mock: { calls: unknown[][] } };

function dispatchedActions(spy: DispatchSpy): { type: string }[] {
  return spy.mock.calls.map((call) => call[0] as { type: string });
}

function dispatchedRegister(spy: DispatchSpy): { payload: Record<string, unknown> } | undefined {
  return dispatchedActions(spy).find((a) => a.type === AuthActions.register.type) as
    | { payload: Record<string, unknown> }
    | undefined;
}

const VALID_SELECTION: HomePointSelection = {
  center: { lat: 40.19, lng: 44.51 },
  district: {
    id: 'd1111111-1111-1111-1111-111111111111',
    code: 'kentron',
    nameEn: 'Kentron',
    nameHy: 'Կենտրոն',
    nameRu: 'Кентрон',
  },
  resolving: false,
  outsideYerevan: false,
  deliberate: true,
  geoState: 'idle',
  lowAccuracyMeters: null,
  canConfirm: true,
};

describe('RegisterFormComponent — account fields', () => {
  it('does not dispatch register when the form is invalid, and marks controls touched', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    component['submitWithoutHomePoint']();

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(component['registerForm'].controls.password.touched).toBe(true);
  });

  it('dispatches register for a valid 72-byte Latin password', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'a'.repeat(72));
    component['submitWithoutHomePoint']();

    expect(dispatchSpy).toHaveBeenCalledWith(
      AuthActions.register({
        payload: {
          firstName: 'Ann',
          lastName: 'Doe',
          email: 'ann@example.com',
          password: 'a'.repeat(72),
          phoneNumber: '+37499123456',
          preferredLanguage: 'en',
        },
      }),
    );
  });

  it('sends the UI language switched to hy before submitting', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    TestBed.inject(LanguageService).current.set({
      code: 'hy',
      flag: '',
      native: 'Հայերեն',
      label: 'Armenian',
    });
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['submitWithoutHomePoint']();

    expect(dispatchedRegister(dispatchSpy)?.payload['preferredLanguage']).toBe('hy');
  });

  // ADR-021's 2026-09-27 amendment: registration used to accept a password of any length, so
  // a passphrase that exceeds BCrypt's 72-UTF-8-byte ceiling must now be rejected client-side
  // — without ever reaching the store/effect/service — rather than silently truncated or sent
  // to the server to bounce back as an untranslated string. 37 Armenian characters = 74 UTF-8
  // bytes, one past the cap (see max-byte-length.validator.spec.ts for the same boundary case).
  it('does not dispatch register for an over-long Armenian password, and reports it through passwordErrorKey', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'ա'.repeat(37));
    component['submitWithoutHomePoint']();

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(component['registerForm'].controls.password.touched).toBe(true);
    expect(component['passwordErrorKey']()).toBe('auth.validation.passwordTooLong');
  });

  it('accepts a 36-character Armenian password (exactly 72 bytes)', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'ա'.repeat(36));
    component['submitWithoutHomePoint']();

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('RegisterFormComponent — two-step sign-up (home-point model)', () => {
  it('"Continue" validates on the client and advances WITHOUT creating the account', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    fixture.detectChanges();

    expect(component['step']()).toBe(2);
    // The ONLY dispatch allowed here is clearing the stale auth error.
    expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.clearAuthError());
    expect(dispatchedRegister(dispatchSpy)).toBeUndefined();
  });

  it('"Continue" stays on step 1 when the account fields are invalid', () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;

    component['continueToHomePoint']();

    expect(component['step']()).toBe(1);
  });

  it('"Create account" sends the chosen coordinates in the register payload', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    component['onHomeSelectionChange'](VALID_SELECTION);
    component['submitWithHomePoint']();

    expect(dispatchSpy).toHaveBeenCalledWith(
      AuthActions.register({
        payload: {
          firstName: 'Ann',
          lastName: 'Doe',
          email: 'ann@example.com',
          password: 'Password1!',
          phoneNumber: '+37499123456',
          preferredLanguage: 'en',
          homeLatitude: 40.19,
          homeLongitude: 44.51,
        },
      }),
    );
  });

  it('"Skip" sends NEITHER coordinate — the backend rejects one without the other', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    component['onHomeSelectionChange'](VALID_SELECTION);
    component['submitWithoutHomePoint']();

    const registerAction = dispatchedRegister(dispatchSpy);
    expect(registerAction).toBeDefined();
    expect(registerAction!.payload).not.toHaveProperty('homeLatitude');
    expect(registerAction!.payload).not.toHaveProperty('homeLongitude');
  });

  it('"Create account" stays inert until the map reports a deliberate, valid point', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    // Untouched map: a coordinate exists (the city centre) but nobody chose it.
    component['onHomeSelectionChange']({
      ...VALID_SELECTION,
      deliberate: false,
      canConfirm: false,
    });
    fixture.detectChanges();

    expect(component['canCreateWithPoint']()).toBe(false);
    component['submitWithHomePoint']();
    expect(dispatchedRegister(dispatchSpy)).toBeUndefined();
  });

  it('a point outside Yerevan blocks "Create account" but never "Skip"', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    component['onHomeSelectionChange']({
      ...VALID_SELECTION,
      district: null,
      outsideYerevan: true,
      canConfirm: false,
    });

    expect(component['canCreateWithPoint']()).toBe(false);

    component['submitWithoutHomePoint']();
    expect(dispatchedRegister(dispatchSpy)).toBeDefined();
  });

  it('auth.duplicate_email returns to step 1 with the email in error and everything else kept', () => {
    const { fixture, mockStore } = setup();
    const component = fixture.componentInstance;

    fillValidForm(component, 'Password1!');
    component['continueToHomePoint']();
    component['onHomeSelectionChange'](VALID_SELECTION);
    expect(component['step']()).toBe(2);

    mockStore.setState(
      authState({ error: 'Email already registered', errorCode: 'auth.duplicate_email' }),
    );
    fixture.detectChanges();

    expect(component['step']()).toBe(1);
    expect(component['registerForm'].controls.email.hasError('emailTaken')).toBe(true);
    expect(component['emailErrorKey']()).toBe('auth.validation.emailTaken');
    // Nothing else is thrown away — including the point the user already chose.
    expect(component['registerForm'].controls.firstName.value).toBe('Ann');
    expect(component['registerForm'].controls.password.value).toBe('Password1!');
    expect(component['homeSelection']()).toEqual(VALID_SELECTION);
  });

  it('auth.home_point_outside_yerevan is read from errorCode, not from a field error', () => {
    const { fixture } = setup({
      error: 'Home point must be inside Yerevan',
      errorCode: 'auth.home_point_outside_yerevan',
    });
    const component = fixture.componentInstance;

    expect(component['serverOutsideYerevan']()).toBe(true);
    // ...and it does NOT bounce the user back to step 1 the way a duplicate
    // email does: the field they have to fix is on step 2.
    expect(component['step']()).toBe(1);
  });
});

describe('RegisterFormComponent — email verification (ADR-028)', () => {
  it('shows the "check your email" step with the address and a resend button once registered', () => {
    const { fixture } = setup({ pendingVerificationEmail: 'ann@example.com' });
    const el: HTMLElement = fixture.nativeElement;

    const step = el.querySelector('[data-testid="check-email-step"]');
    expect(step).not.toBeNull();
    expect(step!.textContent).toContain('ann@example.com');
    expect(el.querySelector('app-resend-verification')).not.toBeNull();
    // The sign-up form is gone: nobody is signed in and nothing more to fill in.
    expect(el.querySelector('form.auth-form')).toBeNull();
  });

  it('shows the form (not the verification step) before registering', () => {
    const { fixture } = setup();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="check-email-step"]')).toBeNull();
    expect(el.querySelector('form.auth-form')).not.toBeNull();
  });

  it.each([
    ['auth.verification_cooldown', 'auth.verification.registerCooldown'],
    ['auth.registration_unavailable', 'auth.verification.registrationUnavailable'],
  ])('%s gets a translated message instead of the raw server title', (code, key) => {
    const { fixture } = setup({ error: 'Raw English title', errorCode: code });

    expect(fixture.componentInstance['errorTranslationKey']()).toBe(key);
    expect(fixture.nativeElement.textContent).toContain(key);
    expect(fixture.nativeElement.textContent).not.toContain('Raw English title');
  });
});
