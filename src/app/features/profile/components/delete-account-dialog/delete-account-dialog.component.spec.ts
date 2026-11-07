import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';

import en from '../../../../../../public/i18n/en.json';
import type { OpenRental } from '../../../../api/api-error.model';
import { AuthApiService } from '../../../auth/services/auth-api.service';
import * as AuthActions from '../../../auth/store/auth.actions';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';

function rental(overrides: Partial<OpenRental> = {}): OpenRental {
  return {
    bookingId: 'b1',
    listingTitle: 'Lego castle',
    listingImageUrl: '/uploads/castle.jpg',
    startDate: '2026-11-10',
    endDate: '2026-11-14',
    role: 'renter',
    ...overrides,
  };
}

function problem(status: number, body: unknown): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('DeleteAccountDialogComponent (AD-4, ADR-056)', () => {
  let fixture: ComponentFixture<DeleteAccountDialogComponent>;
  let store: MockStore;
  let router: Router;
  let closed: number;
  const deleteAccount = vi.fn();
  const messageService = { add: vi.fn() };

  const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);
  const input = () => q<HTMLInputElement>('.dad input')!;
  const confirmBtn = () => q<HTMLButtonElement>('[data-testid="dad-confirm"]')!;
  const cancelBtn = () => q<HTMLButtonElement>('[data-testid="dad-cancel"]')!;
  const closeBtn = () => q<HTMLButtonElement>('[data-testid="dad-close"]')!;
  const dispatched = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map(([a]) => a.type as string);

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(hasPassword = true): Promise<void> {
    fixture.componentRef.setInput('hasPassword', hasPassword);
    fixture.componentRef.setInput('visible', true);
    await settle();
  }

  async function type(value: string): Promise<void> {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    await settle();
  }

  async function submit(): Promise<void> {
    confirmBtn().click();
    await settle();
  }

  beforeEach(() => {
    closed = 0;
    deleteAccount.mockReset();
    messageService.add.mockReset();
    TestBed.configureTestingModule({
      imports: [DeleteAccountDialogComponent],
      providers: [
        provideRouter([]),
        provideMockStore({ initialState: {} }),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: AuthApiService, useValue: { deleteAccount } },
        { provide: MessageService, useValue: messageService },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.use('en');
    store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(DeleteAccountDialogComponent);
    fixture.componentInstance.closed.subscribe(() => closed++);
    fixture.componentRef.setInput('visible', false);
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-dialog-mask').forEach((el) => el.remove());
  });

  it('renders nothing while closed', async () => {
    await settle();
    expect(q('.dad')).toBeNull();
  });

  it('is labelled by its title and lists what is erased and what stays', async () => {
    await open();

    const labelledBy = q('.dad')!.getAttribute('aria-labelledby');
    expect(document.getElementById(labelledBy!)?.textContent).toContain('Delete your account?');
    expect(q('.dad__erased')?.textContent).toContain('Profile');
    expect(q('.dad__erased')?.textContent).toContain('Places');
    expect(q('.dad__erased')?.textContent).toContain('Account');
    expect(q('.dad__stays-summary')?.textContent).toContain('Deleted user');
    expect(q('.dad__stays-summary')?.textContent).toContain('archived');
    expect(q('.dad__stays-summary')?.textContent).toContain('pending requests are closed');
  });

  it('asks for the password when the account has one', async () => {
    await open(true);

    expect(input().type).toBe('password');
    expect(q('.dad')?.textContent).toContain('Enter your password to confirm');
  });

  it('asks for the email (no hint) for a Google-only account and sends it trimmed', async () => {
    deleteAccount.mockReturnValue(of(undefined));
    await open(false);

    expect(input().type).toBe('email');
    expect(q('.dad')?.textContent).toContain('Type your email to confirm');
    expect(q('.uii-helper')).toBeNull();

    await type('  me@dorent.am ');
    await submit();

    expect(deleteAccount).toHaveBeenCalledWith({ password: null, email: 'me@dorent.am' });
  });

  it('sends the password body for a password account', async () => {
    deleteAccount.mockReturnValue(of(undefined));
    await open(true);

    await type('Secret123');
    await submit();

    expect(deleteAccount).toHaveBeenCalledWith({ password: 'Secret123', email: null });
  });

  it('toggles the "what stays" list with aria-expanded / aria-controls', async () => {
    await open();
    const toggle = q<HTMLButtonElement>('[data-testid="dad-stays-toggle"]')!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const list = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(list.hidden).toBe(true);

    toggle.click();
    await settle();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    expect(q('.dad__stays-summary')).toBeNull();
  });

  describe('wrong value (400 account.invalid_confirmation)', () => {
    it('shows the password text inline, keeps the value, flags the field and keeps it focused', async () => {
      deleteAccount.mockReturnValue(
        throwError(() => problem(400, { errorCode: 'account.invalid_confirmation' })),
      );
      await open(true);
      await type('wrong');
      await submit();

      const alert = q('.uii-helper--error')!;
      expect(alert.getAttribute('role')).toBe('alert');
      expect(alert.textContent).toContain('That password is incorrect.');
      expect(input().value).toBe('wrong');
      expect(input().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(input());
      expect(closed).toBe(0);
      expect(confirmBtn().getAttribute('aria-disabled')).toBeNull();
    });

    it('shows the email text for a Google-only account', async () => {
      deleteAccount.mockReturnValue(
        throwError(() => problem(400, { errorCode: 'account.invalid_confirmation' })),
      );
      await open(false);
      await type('other@dorent.am');
      await submit();

      expect(q('.uii-helper--error')?.textContent).toContain(
        'That email doesn’t match this account.',
      );
    });

    it('does not call the API for an empty field and reports it as the same inline error', async () => {
      await open(true);
      await submit();

      expect(deleteAccount).not.toHaveBeenCalled();
      expect(q('.uii-helper--error')?.textContent).toContain('That password is incorrect.');
    });
  });

  describe('while the request is in flight', () => {
    it('shows "Deleting…", locks the field and disables Cancel, close and Escape', async () => {
      const pending = new Subject<void>();
      deleteAccount.mockReturnValue(pending);
      await open();
      await type('Secret123');
      await submit();

      expect(confirmBtn().textContent).toContain('Deleting…');
      expect(confirmBtn().getAttribute('aria-disabled')).toBe('true');
      expect(q('.pi-spinner')).not.toBeNull();
      expect(input().hasAttribute('readonly')).toBe(true);
      expect(cancelBtn().disabled).toBe(true);
      expect(closeBtn().disabled).toBe(true);

      cancelBtn().click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();
      expect(closed).toBe(0);

      // A second submit while loading does not send a second request.
      confirmBtn().click();
      await settle();
      expect(deleteAccount).toHaveBeenCalledTimes(1);
    });

    it('closes through Cancel, the close button and Escape when idle', async () => {
      await open();

      cancelBtn().click();
      closeBtn().click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await settle();

      expect(closed).toBe(3);
    });
  });

  describe('blocked by open rentals (409 account.has_open_rentals)', () => {
    async function block(rentals: OpenRental[]): Promise<void> {
      deleteAccount.mockReturnValue(
        throwError(() =>
          problem(409, { errorCode: 'account.has_open_rentals', openRentals: rentals }),
        ),
      );
      await open();
      await type('Secret123');
      await submit();
    }

    it('replaces the body with the rental list: image or placeholder, title, dates, role, link', async () => {
      await block([
        rental(),
        rental({ bookingId: 'b2', listingTitle: 'Bike', listingImageUrl: null, role: 'owner' }),
      ]);

      expect(q('.dad__title')?.textContent).toContain('You can’t delete your account yet');
      expect(q('.dad')?.textContent).toContain(
        'Finish these rentals or cancel those not yet handed over.',
      );
      expect(q('input')).toBeNull();
      expect(q('[data-testid="dad-confirm"]')).toBeNull();

      const rows = document.querySelectorAll<HTMLAnchorElement>('[data-testid="dad-rental"]');
      expect(rows.length).toBe(2);
      expect(rows[0].getAttribute('href')).toBe('/bookings/b1');
      expect(rows[1].getAttribute('href')).toBe('/bookings/b2');
      expect(rows[0].querySelector('img')?.getAttribute('src')).toBe('/uploads/castle.jpg');
      expect(rows[1].querySelector('img')).toBeNull();
      expect(rows[1].querySelector('.dad__thumb--placeholder')).not.toBeNull();
      expect(rows[0].textContent).toContain('Lego castle');
      expect(rows[0].textContent).toContain('10 Nov – 14 Nov, 2026');
      expect(rows[0].textContent).toContain('You’re renting');
      expect(rows[1].textContent).toContain('You’re lending');
    });

    it('points the CTA at My rentals when any row is a rental of the user', async () => {
      await block([rental(), rental({ bookingId: 'b2', role: 'owner' })]);

      const cta = q<HTMLAnchorElement>('[data-testid="dad-cta"]')!;
      expect(cta.getAttribute('href')).toBe('/profile/rentals');
      expect(cta.textContent).toContain('Go to my rentals');
    });

    it('points the CTA at Incoming requests when every row is a lending one', async () => {
      await block([rental({ role: 'owner' }), rental({ bookingId: 'b2', role: 'owner' })]);

      const cta = q<HTMLAnchorElement>('[data-testid="dad-cta"]')!;
      expect(cta.getAttribute('href')).toBe('/profile/requests');
      expect(cta.textContent).toContain('Go to incoming requests');
    });

    it('moves focus to the title, not to a field', async () => {
      await block([rental()]);

      expect(document.activeElement).toBe(q('.dad__title'));
    });
  });

  describe('indefinite errors', () => {
    it.each([
      ['409 account.state_changed', problem(409, { errorCode: 'account.state_changed' })],
      ['403 account.admin_cannot_delete', problem(403, { errorCode: 'account.admin_cannot_delete' })],
      ['429', problem(429, null)],
      ['500', problem(500, 'boom')],
      ['network error', problem(0, null)],
      ['409 has_open_rentals without a list', problem(409, { errorCode: 'account.has_open_rentals' })],
    ])('%s shows the neutral banner and re-enables Delete', async (_name, error) => {
      deleteAccount.mockReturnValue(throwError(() => error));
      await open();
      await type('Secret123');
      await submit();

      const banner = q('[data-testid="dad-error"]')!;
      expect(banner.getAttribute('role')).toBe('alert');
      expect(banner.textContent).toContain('Something went wrong. Please try again.');
      expect(confirmBtn().getAttribute('aria-disabled')).toBeNull();
      expect(confirmBtn().textContent).toContain('Delete account');
      expect(input().value).toBe('Secret123');
      expect(cancelBtn().disabled).toBe(false);
      expect(dispatched()).not.toContain(AuthActions.logout.type);
      expect(messageService.add).not.toHaveBeenCalled();
    });

    it('lets the user retry after the banner', async () => {
      deleteAccount.mockReturnValueOnce(throwError(() => problem(500, null)));
      deleteAccount.mockReturnValueOnce(of(undefined));
      await open();
      await type('Secret123');
      await submit();
      await submit();

      expect(deleteAccount).toHaveBeenCalledTimes(2);
      expect(dispatched()).toContain(AuthActions.logout.type);
    });
  });

  describe('outcome', () => {
    it('204: local logout, home, exactly one success toast', async () => {
      deleteAccount.mockReturnValue(of(undefined));
      await open();
      await type('Secret123');
      await submit();

      expect(dispatched()).toEqual([AuthActions.logout.type]);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
      expect(messageService.add).toHaveBeenCalledTimes(1);
      expect(messageService.add.mock.calls[0][0]).toMatchObject({
        severity: 'success',
        summary: 'Your account has been deleted',
      });
      expect(closed).toBe(1);
    });

    it('401: local logout, home, exactly one info toast (never the success one)', async () => {
      deleteAccount.mockReturnValue(throwError(() => problem(401, null)));
      await open();
      await type('Secret123');
      await submit();

      expect(dispatched()).toEqual([AuthActions.logout.type]);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/');
      expect(messageService.add).toHaveBeenCalledTimes(1);
      expect(messageService.add.mock.calls[0][0]).toMatchObject({
        severity: 'info',
        summary: 'You’ve been signed out. If your account was deleted, we’ve sent you an email.',
      });
      expect(closed).toBe(1);
    });

    it('logs out before it navigates home (the last navigation wins)', async () => {
      const order: string[] = [];
      (store.dispatch as ReturnType<typeof vi.fn>).mockImplementation(() => order.push('logout'));
      (router.navigateByUrl as ReturnType<typeof vi.fn>).mockImplementation(() => {
        order.push('navigate');
        return Promise.resolve(true);
      });
      deleteAccount.mockReturnValue(of(undefined));
      await open();
      await type('Secret123');
      await submit();

      expect(order).toEqual(['logout', 'navigate']);
    });
  });
});
