import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import { retryAfterSeconds } from '../../services/retry-after';
import { ResendVerificationComponent } from './resend-verification.component';

function setup(
  options: { startCooling?: boolean; resend?: ReturnType<typeof vi.fn> } = {},
): { fixture: ComponentFixture<ResendVerificationComponent>; resend: ReturnType<typeof vi.fn> } {
  const resend = options.resend ?? vi.fn().mockReturnValue(of(undefined));
  TestBed.configureTestingModule({
    imports: [ResendVerificationComponent, TranslateModule.forRoot()],
    providers: [{ provide: AuthApiService, useValue: { resendVerification: resend } }],
  });
  const fixture = TestBed.createComponent(ResendVerificationComponent);
  fixture.componentRef.setInput('email', 'ann@example.com');
  fixture.componentRef.setInput('startCooling', options.startCooling ?? false);
  fixture.detectChanges();
  return { fixture, resend };
}

describe('ResendVerificationComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts locked for 60 s when the email was just sent (register step)', () => {
    const { fixture } = setup({ startCooling: true });
    const component = fixture.componentInstance;

    expect(component['cooldown']()).toBe(60);
    component['resend']();
    expect(TestBed.inject(AuthApiService).resendVerification).not.toHaveBeenCalled();

    vi.advanceTimersByTime(59_000);
    expect(component['cooldown']()).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(component['cooldown']()).toBe(0);
  });

  it('sends { email }, then locks for 60 s', () => {
    const { fixture, resend } = setup();
    const component = fixture.componentInstance;

    component['resend']();

    expect(resend).toHaveBeenCalledWith({ email: 'ann@example.com' });
    expect(component['sent']()).toBe(true);
    expect(component['cooldown']()).toBe(60);
  });

  it('429 without a readable Retry-After falls back to 60 s and says to wait', () => {
    const resend = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    const { fixture } = setup({ resend });
    const component = fixture.componentInstance;

    component['resend']();

    expect(component['error']()).toBe('cooldown');
    expect(component['cooldown']()).toBe(60);
  });

  it('503 reports "temporarily unavailable" and does not lock the button', () => {
    const resend = vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const { fixture } = setup({ resend });
    const component = fixture.componentInstance;

    component['resend']();

    expect(component['error']()).toBe('unavailable');
    expect(component['cooldown']()).toBe(0);
  });
});

describe('retryAfterSeconds', () => {
  it('uses a numeric Retry-After header when readable', () => {
    const error = new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '42' }) });
    expect(retryAfterSeconds(error)).toBe(42);
  });

  it('falls back to 60 for a missing, non-numeric or non-HTTP error', () => {
    expect(retryAfterSeconds(new HttpErrorResponse({ status: 429 }))).toBe(60);
    expect(
      retryAfterSeconds(
        new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': 'soon' }) }),
      ),
    ).toBe(60);
    expect(retryAfterSeconds(new Error('x'))).toBe(60);
  });
});
