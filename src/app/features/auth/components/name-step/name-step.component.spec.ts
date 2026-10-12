import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { makeUser } from '../../../../../testing/fixtures';
import * as AuthActions from '../../store/auth.actions';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState, type AuthState } from '../../store/auth.state';
import { NameStepComponent } from './name-step.component';

describe('NameStepComponent — mandatory name step (ADR-030 §5)', () => {
  let fixture: ComponentFixture<NameStepComponent>;
  let store: MockStore;
  const messageService = { add: vi.fn() };

  const root = (auth: Partial<AuthState>) => ({ [authFeatureKey]: { ...initialAuthState, ...auth } });
  const signedIn = (firstName: string, extra: Partial<AuthState> = {}) =>
    root({
      isAuthenticated: true,
      user: makeUser({ firstName, lastName: '', email: 'anna.p@gmail.com' }),
      ...extra,
    });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const dialog = () => document.querySelector('.dr-step-dialog--name');
  const continueButton = () =>
    document.querySelector<HTMLButtonElement>('.dr-step-dialog--name button[type="submit"]');
  const fields = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>('.dr-step-dialog--name input'));

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    messageService.add.mockReset();
    TestBed.configureTestingModule({
      imports: [NameStepComponent],
      providers: [
        provideMockStore({ initialState: root({}) }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: MessageService, useValue: messageService },
      ],
    });
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(NameStepComponent);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove());
  });

  const updateNameCalls = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]) => a.type === AuthActions.updateName.type,
    );

  it('does not show for a user who has a first name, for a guest, or while /auth/me is loading', async () => {
    store.setState(signedIn('Anna'));
    await settle();
    expect(dialog()).toBeNull();

    store.setState(root({ isAuthenticated: false, user: null }));
    await settle();
    expect(dialog()).toBeNull();

    store.setState(root({ isAuthenticated: true, user: null }));
    await settle();
    expect(dialog()).toBeNull();
  });

  it('shows for a signed-in user whose first name is empty (whitespace counts as empty)', async () => {
    store.setState(signedIn('   '));
    await settle();

    expect(dialog()).not.toBeNull();
    expect(document.body.textContent).toContain('auth.nameStep.title');
    expect(document.body.textContent).toContain('auth.nameStep.signedInAs');
  });

  it('waits while the auth dialog is still on screen, then appears', async () => {
    store.setState(signedIn(''));
    fixture.componentRef.setInput('suppressed', true);
    await settle();
    expect(dialog()).toBeNull();

    fixture.componentRef.setInput('suppressed', false);
    await settle();
    expect(dialog()).not.toBeNull();
  });

  it('cannot be dismissed: no close button, Esc and a mask click leave it open', async () => {
    store.setState(signedIn(''));
    await settle();

    expect(document.querySelector('.dr-step-dialog--name .p-dialog-close-button')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.p-dialog-mask')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await settle();

    expect(dialog()).not.toBeNull();
  });

  it('"Continue" is always enabled and validates on tap: an empty first name sends nothing and shows the error', async () => {
    store.setState(signedIn(''));
    await settle();
    expect(continueButton()?.disabled).toBe(false);

    continueButton()?.click();
    await settle();

    expect(updateNameCalls()).toHaveLength(0);
    expect(document.body.textContent).toContain('auth.nameStep.error');
    // the error clears as the user types
    type(fields()[0], 'A');
    await settle();
    expect(document.body.textContent).not.toContain('auth.nameStep.error');
  });

  it('PUTs the TRIMMED names; the last name is optional', async () => {
    store.setState(signedIn(''));
    await settle();

    type(fields()[0], '  Anna  ');
    type(fields()[1], '  ');
    continueButton()?.click();
    await settle();

    expect(updateNameCalls()).toHaveLength(1);
    expect(updateNameCalls()[0][0]).toEqual(
      AuthActions.updateName({ payload: { firstName: 'Anna', lastName: '' } }),
    );
  });

  it('a 400 auth.invalid_name is shown on the field; any other failure as the generic banner', async () => {
    store.setState(signedIn(''));
    await settle();

    store.setState(
      signedIn('', { nameError: 'bad name', nameErrorCode: 'auth.invalid_name' }),
    );
    await settle();
    expect(document.body.textContent).toContain('auth.nameStep.error');
    expect(document.querySelector('[data-testid="name-step-error"]')).toBeNull();

    store.setState(signedIn('', { nameError: 'boom', nameErrorCode: null }));
    await settle();
    expect(
      document.querySelector('[data-testid="name-step-error"]')?.textContent,
    ).toContain('profile.personal.errServer');
  });

  it('saves once, then toasts the welcome with the saved name and closes', async () => {
    store.setState(signedIn(''));
    await settle();
    type(fields()[0], 'Anna');
    continueButton()?.click();
    store.setState(signedIn('', { nameSaving: true }));
    await settle();
    expect(continueButton()?.disabled).toBe(true);

    store.setState(signedIn('Anna'));
    await settle();

    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add.mock.calls[0][0]).toMatchObject({ severity: 'success' });
    expect(dialog()).toBeNull();
  });
});
