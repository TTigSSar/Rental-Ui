import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { FaqPageComponent } from './faq-page.component';

const GROUP_IDS = ['renting', 'listing', 'safety', 'payments', 'account'];
const ITEM_IDS = [
  'r1',
  'r2',
  'r4',
  'l1',
  'l2',
  'l3',
  'l4',
  's1',
  's2',
  's3',
  'p1',
  'a1',
  'a2',
  'a3',
];

function setup(): HTMLElement {
  TestBed.configureTestingModule({
    imports: [FaqPageComponent],
    providers: [provideRouter([]), provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    info: {
      faq: {
        title: 'FAQ_TITLE',
        heroLead: 'HERO_LEAD',
        breadcrumbHome: 'HOME',
        breadcrumbLabel: 'CRUMBS',
        helpTitle: 'HELP_TITLE',
        helpText: 'HELP_TEXT',
        helpCta: 'HELP_CTA',
        groups: Object.fromEntries(GROUP_IDS.map((g) => [g, { heading: `H_${g}` }])),
        items: Object.fromEntries(
          ITEM_IDS.map((i) => [i, { question: `Q_${i}`, answer: `A_${i}` }]),
        ),
      },
    },
  });
  translate.use('en');
  const fixture = TestBed.createComponent(FaqPageComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('FaqPageComponent', () => {
  it('renders the title, breadcrumb link to home and all group headings', () => {
    const el = setup();

    expect(el.querySelector('h1')?.textContent).toContain('FAQ_TITLE');
    expect(el.querySelector('.faq-hero__lead')?.textContent).toContain('HERO_LEAD');
    const crumb = el.querySelector('nav a') as HTMLAnchorElement;
    expect(crumb.getAttribute('href')).toBe('/');
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe('CRUMBS');
    const text = el.textContent ?? '';
    for (const g of GROUP_IDS) {
      expect(text).toContain(`H_${g}`);
    }
  });

  it('renders all 14 questions with only r1 answered by default', () => {
    const el = setup();
    const text = el.textContent ?? '';

    for (const i of ITEM_IDS) {
      expect(text).toContain(`Q_${i}`);
    }
    expect(text).toContain('A_r1');
    expect(text).not.toContain('A_r2');
  });

  it('opens a clicked question and closes the previous one', () => {
    const el = setup();
    const triggers = Array.from(el.querySelectorAll<HTMLButtonElement>('.faq-accordion__trigger'));
    triggers[1].click();
    TestBed.tick();

    const text = el.textContent ?? '';
    expect(text).toContain('A_r2');
    expect(text).not.toContain('A_r1');
    expect(triggers[1].getAttribute('aria-expanded')).toBe('true');
    expect(triggers[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the help card with a mailto link', () => {
    const el = setup();
    const cta = el.querySelector('.faq__help-cta') as HTMLAnchorElement;

    expect(cta.getAttribute('href')).toBe('mailto:support@dorent.am');
    expect(cta.textContent).toContain('HELP_CTA');
    expect(el.textContent).toContain('HELP_TITLE');
  });
});
