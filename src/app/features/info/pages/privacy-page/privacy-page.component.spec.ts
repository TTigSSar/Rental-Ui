import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import en from '../../../../../../public/i18n/en.json';
import hy from '../../../../../../public/i18n/hy.json';
import ru from '../../../../../../public/i18n/ru.json';
import { PrivacyPageComponent } from './privacy-page.component';

describe('PrivacyPageComponent (approved legal text, 2026-10-12)', () => {
  let fixture: ComponentFixture<PrivacyPageComponent>;
  let translate: TranslateService;

  const el = () => fixture.nativeElement as HTMLElement;
  const headings = () =>
    Array.from(el().querySelectorAll('h2')).map((h) => h.textContent?.trim());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    });
    translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', en);
    translate.setTranslation('ru', ru);
    translate.setTranslation('hy', hy);
    fixture = TestBed.createComponent(PrivacyPageComponent);
    await settle();
  });

  it('renders the English section titles and the hero', () => {
    expect(el().querySelector('h1')?.textContent).toContain('Privacy Policy');
    expect(headings()).toHaveLength(9);
    expect(headings()[0]).toBe('1. Data we collect');
    expect(headings()[8]).toBe('9. Contact');
  });

  it.each([
    ['ru', '1. Какие данные мы собираем', 'Политика конфиденциальности'],
    ['hy', '1. Ինչ տվյալներ ենք հավաքում', 'Գաղտնիության քաղաքականություն'],
  ])('switches to %s and shows the translated title', async (lang, firstTitle, hero) => {
    translate.use(lang);
    await settle();

    expect(headings()[0]).toBe(firstTitle);
    expect(headings()).toHaveLength(9);
    expect(el().querySelector('h1')?.textContent).toContain(hero);
  });

  it('renders lists as real lists, including nested ones', () => {
    expect(el().querySelectorAll('ul.info-page__list').length).toBeGreaterThan(10);
    expect(el().querySelector('ul ul')).not.toBeNull();
  });

  it('renders support@dorent.am as a mailto link', () => {
    const hrefs = Array.from(el().querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')).map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs)).toEqual(new Set(['mailto:support@dorent.am']));
  });

  it('shows bold inline emphasis without leaking markdown markers', () => {
    expect(el().textContent).not.toContain('**');
    expect(el().querySelector('strong')?.textContent).toBeTruthy();
  });

  it.each(['en', 'ru', 'hy'])('does not mention ToyShare (%s)', async (lang) => {
    translate.use(lang);
    await settle();
    expect(el().textContent).not.toContain('ToyShare');
  });
});
