import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import * as AuthActions from '../../store/auth.actions';
import { RegisterFormComponent } from './register-form.component';

function setup(): { fixture: ComponentFixture<RegisterFormComponent>; store: Store } {
  TestBed.configureTestingModule({
    imports: [RegisterFormComponent, TranslateModule.forRoot()],
    providers: [provideMockStore()],
  });
  const fixture = TestBed.createComponent(RegisterFormComponent);
  const store = TestBed.inject(Store);
  fixture.detectChanges();
  return { fixture, store };
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

describe('RegisterFormComponent', () => {
  it('does not dispatch register when the form is invalid, and marks controls touched', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    component['submit']();

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(component['registerForm'].controls.password.touched).toBe(true);
  });

  it('dispatches register for a valid 72-byte Latin password', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'a'.repeat(72));
    component['submit']();

    expect(dispatchSpy).toHaveBeenCalledWith(
      AuthActions.register({
        payload: {
          firstName: 'Ann',
          lastName: 'Doe',
          email: 'ann@example.com',
          password: 'a'.repeat(72),
          phoneNumber: '+37499123456',
        },
      }),
    );
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
    component['submit']();

    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(component['registerForm'].controls.password.touched).toBe(true);
    expect(component['passwordErrorKey']()).toBe('auth.validation.passwordTooLong');
  });

  it('accepts a 36-character Armenian password (exactly 72 bytes)', () => {
    const { fixture, store } = setup();
    const component = fixture.componentInstance;
    const dispatchSpy = vi.spyOn(store, 'dispatch');

    fillValidForm(component, 'ա'.repeat(36));
    component['submit']();

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
});
