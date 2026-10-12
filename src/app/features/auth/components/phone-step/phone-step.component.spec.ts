import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import * as AuthActions from '../../store/auth.actions';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState, type AuthState } from '../../store/auth.state';
import { PhoneStepComponent } from './phone-step.component';

describe('PhoneStepComponent (ADR-030 §8)', () => {
  let fixture: ComponentFixture<PhoneStepComponent>;
  let store: MockStore;
  let saved: number;
  let dismissed: number;
  const messageService = { add: vi.fn() };

  const root = (auth: Partial<AuthState>) => ({ [authFeatureKey]: { ...initialAuthState, ...auth } });
  const step = () => document.querySelector('.dr-step-dialog--phone');
  const input = () => document.querySelector<HTMLInputElement>('.dr-step-dialog--phone input')!;
  const cta = () =>
    document.querySelector<HTMLButtonElement>('.dr-step-dialog--phone button[type="submit"]')!;
  const later = () => document.querySelector<HTMLButtonElement>('.dr-step__later')!;
  const closeX = () => document.querySelector<HTMLButtonElement>('.dr-step__x')!;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(value: string): void {
    input().value = value;
    input().dispatchEvent(new Event('input'));
  }

  const updatePhoneCalls = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([a]) => a.type === AuthActions.updatePhone.type,
    );

  async function open(context: 'listing' | 'booking' = 'listing'): Promise<void> {
    fixture.componentRef.setInput('context', context);
    fixture.componentRef.setInput('visible', true);
    await settle();
  }

  beforeEach(() => {
    saved = 0;
    dismissed = 0;
    messageService.add.mockReset();
    TestBed.configureTestingModule({
      imports: [PhoneStepComponent],
      providers: [
        provideMockStore({ initialState: root({}) }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: MessageService, useValue: messageService },
      ],
    });
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(PhoneStepComponent);
    fixture.componentInstance.saved.subscribe(() => saved++);
    fixture.componentInstance.dismissed.subscribe(() => dismissed++);
    fixture.componentRef.setInput('visible', false);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove());
  });

  it('renders nothing while closed', async () => {
    await settle();
    expect(step()).toBeNull();
  });

  it('is labelled by its title and uses a tel input with autocomplete=tel', async () => {
    await open();

    const dialog = document.querySelector('.dr-step-dialog--phone')!;
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('auth.phoneStep.title');
    expect(input().type).toBe('tel');
    expect(input().getAttribute('autocomplete')).toBe('tel');
  });

  it('uses the listing copy for a listing and the booking copy for a booking request', async () => {
    await open('listing');
    expect(step()?.textContent).toContain('auth.phoneStep.eyebrowListing');
    expect(step()?.textContent).toContain('auth.phoneStep.ctaListing');

    fixture.componentRef.setInput('visible', false);
    await settle();
    await open('booking');
    expect(step()?.textContent).toContain('auth.phoneStep.eyebrowBooking');
    expect(step()?.textContent).toContain('auth.phoneStep.ctaBooking');
  });

  it.each([
    ['empty', ''],
    ['too few digits', '12 34'],
    ['too many digits', '1'.repeat(21)],
    ['letters', '+374 99 abc 456'],
  ])('validates on submit only: %s shows the error and sends nothing', async (_label, value) => {
    await open();
    type(value);
    await settle();
    expect(document.body.textContent).not.toContain('auth.phoneStep.error');

    cta().click();
    await settle();

    expect(updatePhoneCalls()).toHaveLength(0);
    expect(document.body.textContent).toContain('auth.phoneStep.error');
  });

  it('the error clears as soon as the user types', async () => {
    await open();
    cta().click();
    await settle();
    expect(document.body.textContent).toContain('auth.phoneStep.error');

    type('+');
    await settle();

    expect(document.body.textContent).not.toContain('auth.phoneStep.error');
  });

  it('PUTs the TRIMMED number (the server regex rejects a leading space)', async () => {
    await open();
    type('   +374 (99) 123-456  ');

    cta().click();
    await settle();

    expect(updatePhoneCalls()).toHaveLength(1);
    expect(updatePhoneCalls()[0][0]).toEqual(
      AuthActions.updatePhone({ phoneNumber: '+374 (99) 123-456' }),
    );
  });

  it('while saving: the field is locked, the CTA shows "Saving…" and no route dismisses it', async () => {
    await open();
    type('+374 99 123 456');
    cta().click();
    store.setState(root({ phoneSaving: true }));
    await settle();

    expect(input().disabled).toBe(true);
    expect(cta().disabled).toBe(true);
    expect(cta().textContent).toContain('auth.phoneStep.saving');
    expect(closeX().disabled).toBe(true);
    expect(later().disabled).toBe(true);

    later().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();

    expect(dismissed).toBe(0);
    expect(step()).not.toBeNull();
  });

  it('success: toasts what happens next and emits saved exactly once', async () => {
    await open('booking');
    type('+374 99 123 456');
    cta().click();
    store.setState(root({ phoneSaving: true }));
    await settle();
    store.setState(root({ phoneSaving: false }));
    await settle();

    expect(saved).toBe(1);
    expect(messageService.add).toHaveBeenCalledTimes(1);
    expect(messageService.add.mock.calls[0][0]).toMatchObject({
      severity: 'success',
      summary: 'auth.phoneStep.saved',
      detail: 'auth.phoneStep.savedBooking',
    });
    // a later, unrelated store change does not re-emit
    store.setState(root({ phoneSaving: false, isLoading: true }));
    await settle();
    expect(saved).toBe(1);
  });

  it('failure: stays open, shows the generic error above the field, emits nothing', async () => {
    await open();
    type('+374 99 123 456');
    cta().click();
    store.setState(root({ phoneSaving: true }));
    await settle();
    store.setState(root({ phoneSaving: false, phoneError: 'boom' }));
    await settle();

    expect(saved).toBe(0);
    expect(step()).not.toBeNull();
    expect(document.querySelector('[data-testid="phone-step-error"]')?.textContent).toContain(
      'profile.personal.errServer',
    );
    expect(input().disabled).toBe(false);
    expect(input().value).toBe('+374 99 123 456');
  });

  it('"Not now", the X and Esc dismiss without saving or touching anything', async () => {
    await open();
    later().click();
    closeX().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(dismissed).toBe(3);
    expect(saved).toBe(0);
    expect(updatePhoneCalls()).toHaveLength(0);
  });

  it('reopens clean: empty field, no stale error', async () => {
    await open();
    type('12');
    cta().click();
    await settle();
    expect(document.body.textContent).toContain('auth.phoneStep.error');

    fixture.componentRef.setInput('visible', false);
    await settle();
    await open();

    expect(input().value).toBe('');
    expect(document.body.textContent).not.toContain('auth.phoneStep.error');
  });
});
