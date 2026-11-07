import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';
import { selectIsAuthenticated } from '../../store/auth.selectors';
import { ChatEmailUnsubscribePageComponent } from './chat-email-unsubscribe-page.component';

function setup(token: string | null, unsubscribe = vi.fn(), authenticated = false) {
  TestBed.configureTestingModule({
    imports: [ChatEmailUnsubscribePageComponent, TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({ selectors: [{ selector: selectIsAuthenticated, value: authenticated }] }),
      { provide: AuthApiService, useValue: { unsubscribeChatEmails: unsubscribe } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: { get: (k: string) => (k === 't' ? token : null) } },
        },
      },
    ],
  });
  const store = TestBed.inject(MockStore);
  const dispatch = vi.spyOn(store, 'dispatch');
  const fixture: ComponentFixture<ChatEmailUnsubscribePageComponent> = TestBed.createComponent(
    ChatEmailUnsubscribePageComponent,
  );
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const button = () => el.querySelector<HTMLButtonElement>('.unsub__btn');
  const heading = () => el.querySelector('h1')?.textContent ?? '';
  return { fixture, el, button, heading, unsubscribe, dispatch };
}

describe('ChatEmailUnsubscribePageComponent', () => {
  it('confirm: opening the link changes nothing (no request) and offers the button', () => {
    const { unsubscribe, button, heading, el } = setup('tok');

    expect(unsubscribe).not.toHaveBeenCalled();
    expect(heading()).toContain('auth.chatEmailUnsubscribe.title');
    expect(button()?.textContent).toContain('auth.chatEmailUnsubscribe.button');
    expect(el.querySelector('h1')?.getAttribute('role')).toBeNull();
  });

  it('posts the t query parameter when the button is pressed', () => {
    const unsubscribe = vi.fn().mockReturnValue(of({ result: 'unsubscribed' }));
    const { fixture, button } = setup('abc.def', unsubscribe);

    button()!.click();
    fixture.detectChanges();

    expect(unsubscribe).toHaveBeenCalledWith('abc.def');
  });

  it('loading: shows "Unsubscribing…" with aria-disabled and ignores a second press', () => {
    const pending = new Subject<{ result: 'unsubscribed' }>();
    const unsubscribe = vi.fn().mockReturnValue(pending);
    const { fixture, button } = setup('tok', unsubscribe);

    button()!.click();
    fixture.detectChanges();

    expect(button()!.getAttribute('aria-disabled')).toBe('true');
    expect(button()!.textContent).toContain('auth.chatEmailUnsubscribe.loading');
    button()!.click();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('done: status heading and a link back to Settings', () => {
    const unsubscribe = vi.fn().mockReturnValue(of({ result: 'unsubscribed' }));
    const { fixture, el, button, heading } = setup('tok', unsubscribe);

    button()!.click();
    fixture.detectChanges();

    expect(heading()).toContain('auth.chatEmailUnsubscribe.done');
    expect(el.querySelector('h1')?.getAttribute('role')).toBe('status');
    const link = el.querySelector<HTMLAnchorElement>('a.unsub__link')!;
    expect(link.getAttribute('href')).toBe('/profile/settings');
    expect(link.textContent).toContain('auth.chatEmailUnsubscribe.turnBackOn');
    expect(button()).toBeNull();
  });

  it('already: "already off" heading with a Settings link', () => {
    const unsubscribe = vi.fn().mockReturnValue(of({ result: 'alreadyOff' }));
    const { fixture, el, button, heading } = setup('tok', unsubscribe);

    button()!.click();
    fixture.detectChanges();

    expect(heading()).toContain('auth.chatEmailUnsubscribe.already');
    expect(el.querySelector('h1')?.getAttribute('role')).toBe('status');
    expect(el.querySelector('a.unsub__link')?.getAttribute('href')).toBe('/profile/settings');
  });

  it('invalid: a 400 shows "link no longer works"', () => {
    const unsubscribe = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    const { fixture, el, button, heading } = setup('tok', unsubscribe);

    button()!.click();
    fixture.detectChanges();

    expect(heading()).toContain('auth.chatEmailUnsubscribe.invalid');
    expect(el.querySelector('h1')?.getAttribute('role')).toBe('status');
    expect(el.querySelector('a.unsub__link')?.textContent).toContain(
      'auth.chatEmailUnsubscribe.goToSettings',
    );
  });

  it.each([null, '', '   '])('invalid: a missing or empty t (%j) never calls the API', (t) => {
    const { unsubscribe, button, heading } = setup(t);

    expect(heading()).toContain('auth.chatEmailUnsubscribe.invalid');
    expect(button()).toBeNull();
    expect(unsubscribe).not.toHaveBeenCalled();
  });

  it.each([0, 429, 500])(
    'failed: status %s shows an error line above an enabled button, and retry works',
    (status) => {
      const unsubscribe = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status })))
        .mockReturnValueOnce(of({ result: 'unsubscribed' }));
      const { fixture, el, button, heading } = setup('tok', unsubscribe);

      button()!.click();
      fixture.detectChanges();

      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'auth.chatEmailUnsubscribe.failed',
      );
      expect(button()!.getAttribute('aria-disabled')).toBeNull();
      expect(heading()).toContain('auth.chatEmailUnsubscribe.title');

      button()!.click();
      fixture.detectChanges();
      expect(heading()).toContain('auth.chatEmailUnsubscribe.done');
    },
  );

  it('re-reads the current user after success when someone is signed in', () => {
    const unsubscribe = vi.fn().mockReturnValue(of({ result: 'unsubscribed' }));
    const { fixture, button, dispatch } = setup('tok', unsubscribe, true);

    button()!.click();
    fixture.detectChanges();

    expect(dispatch).toHaveBeenCalledWith(AuthActions.loadCurrentUser());
  });

  it('does not touch the store when signed out', () => {
    const unsubscribe = vi.fn().mockReturnValue(of({ result: 'unsubscribed' }));
    const { fixture, button, dispatch } = setup('tok', unsubscribe, false);

    button()!.click();
    fixture.detectChanges();

    expect(dispatch).not.toHaveBeenCalled();
  });
});
