import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { AuthApiService } from '../../services/auth-api.service';
import { authFeatureKey } from '../../store/auth.reducer';
import { initialAuthState } from '../../store/auth.state';
import { LoginFormComponent } from './login-form.component';

function setup(overrides: Partial<typeof initialAuthState> = {}): {
  fixture: ComponentFixture<LoginFormComponent>;
  mockStore: MockStore;
} {
  TestBed.configureTestingModule({
    imports: [LoginFormComponent, TranslateModule.forRoot()],
    providers: [
      provideMockStore({ initialState: { [authFeatureKey]: { ...initialAuthState, ...overrides } } }),
      { provide: AuthApiService, useValue: { resendVerification: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(LoginFormComponent);
  fixture.detectChanges();
  return { fixture, mockStore: TestBed.inject(MockStore) };
}

describe('LoginFormComponent — unverified account (ADR-028)', () => {
  it('shows the "Email not confirmed" notice with a resend button on 403 auth.email_not_verified', () => {
    const { fixture } = setup({
      error: 'Email not verified',
      errorCode: 'auth.email_not_verified',
    });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="email-not-verified"]')).not.toBeNull();
    expect(el.querySelector('app-resend-verification')).not.toBeNull();
    // The raw English server title is not printed as a generic login error.
    expect(el.textContent).not.toContain('Email not verified');
  });

  it('keeps user_blocked as a plain error banner (same status, different code)', () => {
    const { fixture } = setup({ error: 'User is blocked', errorCode: 'auth.user_blocked' });
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[data-testid="email-not-verified"]')).toBeNull();
    expect(el.querySelector('app-resend-verification')).toBeNull();
    expect(el.textContent).toContain('User is blocked');
  });

  it('resends to the email that was submitted, not whatever is typed afterwards', () => {
    const { fixture } = setup({ error: 'x', errorCode: 'auth.email_not_verified' });
    const component = fixture.componentInstance;

    component['loginForm'].setValue({ email: 'ann@example.com', password: 'Password1!' });
    component['submit']();
    component['loginForm'].controls.email.setValue('someone-else@example.com');

    expect(component['submittedEmail']()).toBe('ann@example.com');
  });
});

describe('LoginFormComponent — Forgot password? (ADR-035)', () => {
  it('sits between the password field and Sign in, and emits the email exactly as typed', () => {
    const { fixture } = setup();
    const component = fixture.componentInstance;
    const emitted: string[] = [];
    component.forgotPassword.subscribe((email) => emitted.push(email));

    component['loginForm'].controls.email.setValue('  not-an-email ');
    const link = fixture.nativeElement.querySelector('[data-testid="forgot-password"]') as HTMLElement;
    link.click();

    expect(emitted).toEqual(['  not-an-email ']);
    const order = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('form input, form button'),
    );
    const forgotIndex = order.indexOf(link);
    expect(order[forgotIndex - 1]?.getAttribute('type')).toBe('button'); // password show/hide toggle
    expect(order[forgotIndex + 1]?.tagName).toBe('BUTTON');
  });
});
