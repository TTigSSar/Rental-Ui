import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Menu } from 'primeng/menu';

import { makeUser } from '../../../../../testing/fixtures';
import * as AuthActions from '../../../auth/store/auth.actions';
import { initialAuthState, type AuthState } from '../../../auth/store/auth.state';
import { ProfileAvatarEditComponent } from './profile-avatar-edit.component';
import en from '../../../../../../public/i18n/en.json';

const PHOTO = '/uploads/avatars/user-1/abc.jpg';

function authState(overrides: Partial<AuthState> = {}, avatarUrl: string | null = null) {
  return {
    auth: {
      ...initialAuthState,
      isAuthenticated: true,
      isInitializing: false,
      user: makeUser({ avatarUrl }),
      ...overrides,
    },
  };
}

@Component({
  standalone: true,
  imports: [ProfileAvatarEditComponent],
  template: `<app-profile-avatar-edit name="Ada Lovelace" [size]="size()" [desktop]="desktop()" />`,
})
class HostComponent {
  readonly size = signal(56);
  readonly desktop = signal(false);
}

interface Testable {
  sheetOpen(): boolean;
  confirmOpen(): boolean;
  menuItems(): { label?: string; items?: { label?: string; separator?: boolean }[] }[];
}

function setup(state = authState(), desktop = false) {
  TestBed.configureTestingModule({
    imports: [HostComponent, TranslateModule.forRoot()],
    providers: [provideMockStore({ initialState: state })],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', { profile: { avatar: en.profile.avatar }, common: { close: 'Close' } });
  translate.use('en');

  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.desktop.set(desktop);
  fixture.detectChanges();
  const store = TestBed.inject(MockStore);
  const dispatch = vi.spyOn(store, 'dispatch');
  const edit = fixture.debugElement.query(By.directive(ProfileAvatarEditComponent));
  const component = edit.componentInstance as unknown as Testable;
  const button = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="profile-avatar-button"]')!;
  const input = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('[data-testid="profile-avatar-input"]')!;
  return { fixture, store, dispatch, component, button, input, edit };
}

function setBusy(fixture: ComponentFixture<unknown>, store: MockStore, state: AuthState['avatarStatus']) {
  store.setState(authState({ avatarStatus: state }, PHOTO));
  fixture.detectChanges();
}

afterEach(() => {
  document.body.querySelectorAll('app-settings-sheet, .p-dialog-mask, .p-menu').forEach((el) => el.remove());
});

describe('ProfileAvatarEditComponent - the avatar button (F-U15..17)', () => {
  it('is one real <button> named "Add profile photo" without a photo, "Change profile photo" with one', () => {
    const none = setup();
    expect(none.button().tagName).toBe('BUTTON');
    expect(none.button().type).toBe('button');
    expect(none.button().getAttribute('aria-label')).toBe('Add profile photo');
    TestBed.resetTestingModule();

    const withPhoto = setup(authState({}, PHOTO));
    expect(withPhoto.button().getAttribute('aria-label')).toBe('Change profile photo');
  });

  it('announces a dialog on mobile and a menu on desktop', () => {
    expect(setup().button().getAttribute('aria-haspopup')).toBe('dialog');
    TestBed.resetTestingModule();
    expect(setup(authState(), true).button().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('hides the face from assistive tech: the button name carries the meaning', () => {
    const { fixture } = setup(authState({}, PHOTO));
    const face = (fixture.nativeElement as HTMLElement).querySelector('.pae__face')!;
    expect(face.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets the circle size from the input (56 / 72 / 96)', () => {
    const { fixture, button } = setup();
    fixture.componentInstance.size.set(96);
    fixture.detectChanges();
    expect(button().style.getPropertyValue('--pae-size')).toBe('96px');
    expect(button().classList.contains('pae--xl')).toBe(true);
  });

  it('mobile shows the camera badge; desktop (option 2) has none at rest, only the hover scrim', () => {
    const mobile = setup();
    expect((mobile.fixture.nativeElement as HTMLElement).querySelector('.pae__badge')).not.toBeNull();
    expect((mobile.fixture.nativeElement as HTMLElement).querySelector('.pae__scrim')).toBeNull();
    TestBed.resetTestingModule();

    const desktop = setup(authState(), true);
    expect((desktop.fixture.nativeElement as HTMLElement).querySelector('.pae__badge')).toBeNull();
    expect((desktop.fixture.nativeElement as HTMLElement).querySelector('.pae__scrim')).not.toBeNull();
  });
});

describe('ProfileAvatarEditComponent - uploading state (F-U18, F-U25)', () => {
  it('uploading: aria-disabled + aria-busy + spinner, and the click is ignored', () => {
    const { fixture, store, button, component } = setup(authState({}, PHOTO));
    setBusy(fixture, store, 'uploading');

    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().getAttribute('aria-busy')).toBe('true');
    expect(button().disabled).toBe(false); // focus is kept
    expect((fixture.nativeElement as HTMLElement).querySelector('.pae__spinner')).not.toBeNull();

    button().click();
    fixture.detectChanges();
    expect(component.sheetOpen()).toBe(false);
  });

  it('back to idle: the avatar is enabled again (the retry path)', () => {
    const { fixture, store, button, component } = setup(authState({}, PHOTO));
    setBusy(fixture, store, 'uploading');
    setBusy(fixture, store, 'idle');

    expect(button().hasAttribute('aria-disabled')).toBe(false);
    button().click();
    fixture.detectChanges();
    expect(component.sheetOpen()).toBe(true);
  });

  it('does not touch the rest of the page: only the avatar button is marked disabled', () => {
    const { fixture, store } = setup();
    setBusy(fixture, store, 'uploading');
    const disabled = (fixture.nativeElement as HTMLElement).querySelectorAll('[aria-disabled="true"], button:disabled');
    expect(disabled).toHaveLength(1);
  });
});

describe('ProfileAvatarEditComponent - file picking (F-U19)', () => {
  function pick(input: HTMLInputElement, file: File | null): void {
    Object.defineProperty(input, 'files', { configurable: true, value: file === null ? [] : [file] });
    input.dispatchEvent(new Event('change'));
  }

  it('accepts only JPEG, PNG and WebP', () => {
    expect(setup().input().getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
  });

  it('dispatches uploadAvatar with the picked file and resets the input', () => {
    const { input, dispatch } = setup();
    const file = new File(['x'], 'me.png', { type: 'image/png' });

    pick(input(), file);

    expect(dispatch).toHaveBeenCalledWith(AuthActions.uploadAvatar({ file }));
    expect(input().value).toBe('');
  });

  it('picking the SAME file twice uploads twice (the value is reset after every pick)', () => {
    const { input, dispatch } = setup();
    const file = new File(['x'], 'me.png', { type: 'image/png' });

    pick(input(), file);
    pick(input(), file);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(input().value).toBe('');
  });

  it('a cancelled picker (no file) dispatches nothing', () => {
    const { input, dispatch } = setup();
    pick(input(), null);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a pick while a mutation is running is not dispatched', () => {
    const { fixture, store, input, dispatch } = setup();
    setBusy(fixture, store, 'removing');
    pick(input(), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('ProfileAvatarEditComponent - sheet on mobile (F-U20)', () => {
  it('opens the settings-sheet shell titled "Profile photo"; no photo: Upload + Cancel only', () => {
    const { fixture, button } = setup();
    button().click();
    fixture.detectChanges();

    const sheet = document.body.querySelector('app-settings-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet!.querySelector('.ns__title')?.textContent).toBe('Profile photo');
    const rows = Array.from(sheet!.querySelectorAll('.pae-sheet .pae-btn')).map((b) => b.textContent?.trim());
    expect(rows).toEqual(['Upload photo', 'Cancel']);
  });

  it('with a photo: Change (primary), quiet-danger Remove, Cancel', () => {
    const { fixture, button } = setup(authState({}, PHOTO));
    button().click();
    fixture.detectChanges();

    const rows = Array.from(document.body.querySelectorAll('.pae-sheet .pae-btn'));
    expect(rows.map((b) => b.textContent?.trim())).toEqual(['Change photo', 'Remove photo', 'Cancel']);
    expect(rows[0].classList.contains('pae-btn--primary')).toBe(true);
    expect(rows[1].classList.contains('pae-btn--quiet-danger')).toBe(true);
    expect(rows[2].classList.contains('pae-btn--secondary')).toBe(true);
  });

  it('Upload opens the file picker and closes the sheet; focus returns to the avatar', () => {
    const { fixture, button, input } = setup();
    const click = vi.spyOn(input(), 'click');
    button().click();
    fixture.detectChanges();

    (document.body.querySelector('.pae-sheet__primary') as HTMLElement).click();
    fixture.detectChanges();
    TestBed.tick();

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector('app-settings-sheet')).toBeNull();
    expect(document.activeElement).toBe(button());
  });

  it('Cancel closes the sheet and returns focus to the avatar', () => {
    const { fixture, button, component } = setup();
    button().click();
    fixture.detectChanges();

    (document.body.querySelector('.pae-sheet__cancel') as HTMLElement).click();
    fixture.detectChanges();
    TestBed.tick();

    expect(component.sheetOpen()).toBe(false);
    expect(document.activeElement).toBe(button());
  });

  it('does not render a menu on mobile', () => {
    const { fixture } = setup();
    expect(fixture.debugElement.query(By.directive(Menu))).toBeNull();
  });
});

describe('ProfileAvatarEditComponent - menu on desktop (F-U20)', () => {
  it('toggles the popup menu instead of opening the sheet', () => {
    const { fixture, button, component } = setup(authState({}, PHOTO), true);
    const menu = fixture.debugElement.query(By.directive(Menu)).componentInstance as Menu;
    const toggle = vi.spyOn(menu, 'toggle').mockImplementation(() => undefined);

    button().click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(component.sheetOpen()).toBe(false);
    expect(document.body.querySelector('app-settings-sheet')).toBeNull();
  });

  it('model: heading "Profile photo", Change, hairline, Remove with a photo', () => {
    const { component } = setup(authState({}, PHOTO), true);
    const [group] = component.menuItems();
    expect(group.label).toBe('Profile photo');
    expect(group.items?.map((i) => (i.separator ? '---' : i.label))).toEqual(['Change photo', '---', 'Remove photo']);
  });

  it('model: a single "Upload photo" item without a photo', () => {
    const { component } = setup(authState(), true);
    const [group] = component.menuItems();
    expect(group.items?.map((i) => i.label)).toEqual(['Upload photo']);
  });
});

describe('ProfileAvatarEditComponent - remove confirmation (F-U21, F-U23)', () => {
  function openConfirm(ctx: ReturnType<typeof setup>): void {
    ctx.button().click();
    ctx.fixture.detectChanges();
    const remove = Array.from(document.body.querySelectorAll<HTMLElement>('.pae-sheet .pae-btn')).find(
      (b) => b.textContent?.includes('Remove photo'),
    )!;
    remove.click();
    ctx.fixture.detectChanges();
  }

  it('Remove opens a role=alertdialog with the copy and Cancel + Remove; nothing is dispatched yet', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);

    expect(ctx.component.confirmOpen()).toBe(true);
    const dialog = document.body.querySelector('.pae-remove') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.querySelector('.pae-remove__title')?.textContent).toBe('Remove profile photo?');
    expect(dialog.querySelector('.pae-remove__lead')?.textContent).toBe('Your initials will show instead.');
    const buttons = Array.from(dialog.querySelectorAll('.pae-remove__actions .pae-btn')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Cancel', 'Remove']);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  it('Cancel is the FIRST focusable control (focus starts there) and Remove is danger', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);
    const dialog = document.body.querySelector('.pae-remove') as HTMLElement;
    const first = dialog.querySelector('button') as HTMLElement;
    expect(first.textContent?.trim()).toBe('Cancel');
    expect(dialog.querySelector('[data-testid="avatar-remove-confirm"]')!.classList.contains('pae-btn--danger')).toBe(true);
  });

  it('Remove dispatches removeAvatar and closes', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);

    (document.body.querySelector('[data-testid="avatar-remove-confirm"]') as HTMLElement).click();
    ctx.fixture.detectChanges();

    expect(ctx.dispatch).toHaveBeenCalledWith(AuthActions.removeAvatar());
    expect(ctx.component.confirmOpen()).toBe(false);
  });

  it('Cancel closes without dispatching', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);

    (document.body.querySelector('.pae-remove__actions .pae-btn--secondary') as HTMLElement).click();
    ctx.fixture.detectChanges();

    expect(ctx.component.confirmOpen()).toBe(false);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  it('Escape declines', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    ctx.fixture.detectChanges();

    expect(ctx.component.confirmOpen()).toBe(false);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  it('a backdrop click declines', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);
    const mask = document.body.querySelector('.pae-remove__mask') as HTMLElement;
    expect(mask).not.toBeNull();

    mask.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    ctx.fixture.detectChanges();

    expect(ctx.component.confirmOpen()).toBe(false);
    expect(ctx.dispatch).not.toHaveBeenCalled();
  });

  it('the dialog has an accessible name (the header the aria-labelledby points at)', () => {
    const ctx = setup(authState({}, PHOTO));
    openConfirm(ctx);
    const dialog = document.body.querySelector('.pae-remove') as HTMLElement;
    const label = document.getElementById(dialog.getAttribute('aria-labelledby') as string);
    expect(label?.textContent?.trim()).toBe('Remove profile photo?');
  });
});

describe('profile.avatar copy (F-U24)', () => {
  it('ships every key in en, ru and hy, with the Armenian iPhone path kept in English', async () => {
    const hy = (await import('../../../../../../public/i18n/hy.json')).default;
    const ru = (await import('../../../../../../public/i18n/ru.json')).default;
    const keys = Object.keys(en.profile.avatar).sort();
    expect(keys).toEqual(
      [
        'sheetTitle', 'upload', 'change', 'remove', 'cancel', 'buttonChange', 'buttonAdd', 'uploading',
        'confirmTitle', 'confirmBody', 'confirmButton',
        'errorUnsupported', 'errorTooLarge', 'errorBusy', 'errorGeneric',
      ].sort(),
    );
    expect(Object.keys(ru.profile.avatar).sort()).toEqual(keys);
    expect(Object.keys(hy.profile.avatar).sort()).toEqual(keys);
    expect(hy.profile.avatar.errorUnsupported).toContain('Settings → Camera → Formats → Most Compatible');
  });
});
