import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { makeUser } from '../../../../../testing/fixtures';
import * as AuthActions from '../../../auth/store/auth.actions';
import { authFeatureKey } from '../../../auth/store/auth.reducer';
import { initialAuthState, type AuthState } from '../../../auth/store/auth.state';
import { PersonalInfoCardComponent } from './personal-info-card.component';

describe('PersonalInfoCardComponent (ADR-030 board 3)', () => {
  let fixture: ComponentFixture<PersonalInfoCardComponent>;
  let store: MockStore;
  const messageService = { add: vi.fn() };

  const authState = (extra: Partial<AuthState> = {}, phone: string | null = '+374 91 234 567') =>
    ({
      [authFeatureKey]: {
        ...initialAuthState,
        isAuthenticated: true,
        user: makeUser({
          firstName: 'Anna',
          lastName: 'Petrosyan',
          email: 'anna.p@gmail.com',
          phoneNumber: phone,
        }),
        ...extra,
      },
    }) as never;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(sel: string) => el().querySelector<T>(sel);
  const inputs = () => Array.from(el().querySelectorAll<HTMLInputElement>('input'));
  const saveButton = () => q<HTMLButtonElement>('button[type="submit"]')!;

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  const dispatched = (type: string) =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls
      .map(([a]) => a)
      .filter((a) => a.type === type);

  async function startEditing(phone: string | null = '+374 91 234 567'): Promise<void> {
    store.setState(authState({}, phone));
    await settle();
    q('[data-testid="personal-info-edit"]')!.click();
    await settle();
  }

  beforeEach(() => {
    messageService.add.mockReset();
    TestBed.configureTestingModule({
      imports: [PersonalInfoCardComponent],
      providers: [
        provideMockStore({ initialState: authState() }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: MessageService, useValue: messageService },
      ],
    });
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(PersonalInfoCardComponent);
  });

  describe('view', () => {
    it('shows the name, the phone with the privacy note, and the read-only email with its note', async () => {
      await settle();

      const text = el().textContent ?? '';
      expect(text).toContain('Anna Petrosyan');
      expect(text).toContain('+374 91 234 567');
      expect(text).toContain('anna.p@gmail.com');
      expect(text).toContain('auth.phoneStep.privacy');
      expect(text).toContain('profile.personal.emailNote');
    });

    it('shows "Not added" for an empty phone (and no phone number)', async () => {
      store.setState(authState({}, null));
      await settle();

      expect(el().textContent).toContain('profile.personal.none');
    });
  });

  describe('edit', () => {
    it('opens in place with the current values and a read-only email', async () => {
      await startEditing();

      const [first, last, phone, email] = inputs();
      expect(first.value).toBe('Anna');
      expect(last.value).toBe('Petrosyan');
      expect(phone.value).toBe('+374 91 234 567');
      expect(phone.type).toBe('tel');
      expect(email.value).toBe('anna.p@gmail.com');
      expect(email.hasAttribute('readonly')).toBe(true);
    });

    it('Cancel discards the changes and goes back to the view', async () => {
      await startEditing();
      type(inputs()[0], 'Changed');
      q<HTMLButtonElement>('.pi-card__cancel')!.click();
      await settle();

      expect(q('[data-testid="personal-info-edit"]')).not.toBeNull();
      expect(el().textContent).toContain('Anna Petrosyan');
      expect(dispatched(AuthActions.updateName.type)).toHaveLength(0);
    });

    it('an empty first name shows the name error and sends nothing', async () => {
      await startEditing();
      type(inputs()[0], '   ');
      saveButton().click();
      await settle();

      expect(el().textContent).toContain('auth.nameStep.error');
      expect(dispatched(AuthActions.updateName.type)).toHaveLength(0);
    });

    it('an invalid phone shows the phone error and sends nothing', async () => {
      await startEditing();
      type(inputs()[2], '12 34');
      saveButton().click();
      await settle();

      expect(el().textContent).toContain('auth.phoneStep.error');
      expect(dispatched(AuthActions.updateName.type)).toHaveLength(0);
      expect(dispatched(AuthActions.updatePhone.type)).toHaveLength(0);
    });

    it('clearing a saved phone is refused (the API has no "remove")', async () => {
      await startEditing('+374 91 234 567');
      type(inputs()[2], '');
      saveButton().click();
      await settle();

      expect(el().textContent).toContain('auth.phoneStep.error');
      expect(dispatched(AuthActions.updateName.type)).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('PUTs the name only when the phone did not change, then toasts and returns to the view', async () => {
      await startEditing();
      type(inputs()[0], '  Anya ');
      saveButton().click();

      expect(dispatched(AuthActions.updateName.type)).toEqual([
        AuthActions.updateName({ payload: { firstName: 'Anya', lastName: 'Petrosyan' } }),
      ]);

      store.setState(authState({ nameSaving: true }));
      await settle();
      expect(saveButton().disabled).toBe(true);
      expect(inputs().slice(0, 3).every((i) => i.disabled)).toBe(true);

      store.setState(authState({ nameSaving: false }));
      await settle();

      expect(dispatched(AuthActions.updatePhone.type)).toHaveLength(0);
      expect(messageService.add).toHaveBeenCalledTimes(1);
      expect(messageService.add.mock.calls[0][0]).toMatchObject({
        severity: 'success',
        summary: 'profile.personal.saved',
      });
      expect(q('[data-testid="personal-info-edit"]')).not.toBeNull();
    });

    it('PUTs the phone after the name, only because it changed, trimmed', async () => {
      await startEditing();
      type(inputs()[2], '  +374 99 000 111 ');
      saveButton().click();
      store.setState(authState({ nameSaving: true }));
      await settle();
      expect(dispatched(AuthActions.updatePhone.type)).toHaveLength(0);

      store.setState(authState({ nameSaving: false }));
      await settle();
      expect(dispatched(AuthActions.updatePhone.type)).toEqual([
        AuthActions.updatePhone({ phoneNumber: '+374 99 000 111' }),
      ]);
      // still saving: not finished until the phone answers
      expect(messageService.add).not.toHaveBeenCalled();

      store.setState(authState({ phoneSaving: true }));
      await settle();
      store.setState(authState({ phoneSaving: false }));
      await settle();

      expect(messageService.add).toHaveBeenCalledTimes(1);
      expect(q('[data-testid="personal-info-edit"]')).not.toBeNull();
    });

    it('an empty phone that was empty stays empty: it is never sent', async () => {
      await startEditing(null);
      type(inputs()[0], 'Anya');
      saveButton().click();
      store.setState(authState({ nameSaving: true }, null));
      await settle();
      store.setState(authState({ nameSaving: false }, null));
      await settle();

      expect(dispatched(AuthActions.updatePhone.type)).toHaveLength(0);
      expect(messageService.add).toHaveBeenCalledTimes(1);
    });

    it('a server error shows pi.errServer inline, keeps what was typed and stays in edit mode', async () => {
      await startEditing();
      type(inputs()[0], 'Anya');
      saveButton().click();
      store.setState(authState({ nameSaving: true }));
      await settle();
      store.setState(authState({ nameSaving: false, nameError: 'boom', nameErrorCode: null }));
      await settle();

      expect(
        q('[data-testid="personal-info-error"]')?.textContent,
      ).toContain('profile.personal.errServer');
      expect(inputs()[0].value).toBe('Anya');
      expect(messageService.add).not.toHaveBeenCalled();
      expect(saveButton().disabled).toBe(false);
      // and Save can be tapped again
      saveButton().click();
      expect(dispatched(AuthActions.updateName.type)).toHaveLength(2);
    });

    it('a failed phone save keeps edit mode and shows the same inline error', async () => {
      await startEditing();
      type(inputs()[2], '+374 99 000 111');
      saveButton().click();
      store.setState(authState({ nameSaving: true }));
      await settle();
      store.setState(authState({ nameSaving: false }));
      await settle();
      store.setState(authState({ phoneSaving: true }));
      await settle();
      store.setState(authState({ phoneSaving: false, phoneError: 'boom' }));
      await settle();

      expect(q('[data-testid="personal-info-error"]')).not.toBeNull();
      expect(messageService.add).not.toHaveBeenCalled();
    });
  });
});
