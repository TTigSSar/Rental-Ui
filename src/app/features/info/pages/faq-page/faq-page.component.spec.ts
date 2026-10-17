import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { FaqPageComponent } from './faq-page.component';

describe('FaqPageComponent', () => {
  it('renders translated headings, the open answer and the contact text', () => {
    TestBed.configureTestingModule({
      imports: [FaqPageComponent],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      info: {
        faq: {
          heroTitle: 'T',
          heroLead: 'L',
          contactText: 'CONTACT_TXT',
          groups: { renting: { heading: 'H_RENTING' } },
          items: { r1: { question: 'Q_R1', answer: 'A_R1' } },
        },
      },
    });
    translate.use('en');

    const fixture = TestBed.createComponent(FaqPageComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('H_RENTING');
    expect(text).toContain('Q_R1');
    expect(text).toContain('A_R1');
    expect(text).toContain('CONTACT_TXT');
    expect(text).not.toContain('Renting a Toy');
    expect(text).not.toContain("Still have a question?");
  });
});
