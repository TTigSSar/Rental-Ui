import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { LanguageOption } from '../../../../shared/services/language.service';
import { LanguageSheetComponent } from './language-sheet.component';

const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', flag: '', native: 'English', label: 'English' },
  { code: 'hy', flag: '', native: 'Հայերեն', label: 'Armenian' },
  { code: 'ru', flag: '', native: 'Русский', label: 'Russian' },
];

function setup(currentCode = 'hy') {
  TestBed.configureTestingModule({
    imports: [LanguageSheetComponent, TranslateModule.forRoot()],
  });
  const fixture: ComponentFixture<LanguageSheetComponent> =
    TestBed.createComponent(LanguageSheetComponent);
  fixture.componentRef.setInput('languages', LANGUAGES);
  fixture.componentRef.setInput('currentCode', currentCode);
  fixture.detectChanges();
  const el = document.body.querySelector<HTMLElement>('app-settings-sheet')!;
  const options = () => Array.from(el.querySelectorAll<HTMLElement>('[role="option"]'));
  return { fixture, el, options };
}

describe('LanguageSheetComponent', () => {
  it('renders a listbox of native names with lang attributes and a check on the current one', () => {
    const { el, options } = setup('hy');

    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Հայերեն', 'Русский', 'English']);
    expect(options().map((o) => o.getAttribute('lang'))).toEqual(['hy', 'ru', 'en']);
    expect(options().map((o) => o.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(options()[0].querySelector('.pi-check')).not.toBeNull();
    expect(options()[1].querySelector('.pi-check')).toBeNull();
    expect(el.querySelector('.ns__foot')).toBeNull();
  });

  it('focuses the current option on open', async () => {
    const { fixture, options } = setup('ru');
    await fixture.whenStable();

    expect(document.activeElement).toBe(options()[1]);
  });

  it('emits the tapped option', () => {
    const { fixture, options } = setup('en');
    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);

    options()[2].click();

    expect(selected).toHaveBeenCalledWith(LANGUAGES[0]);
  });

  it('moves focus with the arrow keys', () => {
    const { options } = setup('en');
    options()[0].focus();

    options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(document.activeElement).toBe(options()[1]);
  });

  it('closes on Escape and the close button', () => {
    const { fixture, el } = setup();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    el.querySelector<HTMLElement>('.ns__close')!.click();

    expect(closed).toHaveBeenCalledTimes(2);
  });
});
