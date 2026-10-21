import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { UiDatePipe } from './ui-date.pipe';
import { UiDateService, formatUiDate, formatUiDateRange, uiLocaleId } from './ui-date';

// 2026-10-21T10:00:00Z = 14:00 in Yerevan (+04:00)
const INSTANT = '2026-10-21T10:00:00Z';

describe('formatUiDate (ADR-052)', () => {
  it('maps language codes to Angular locale ids and falls back to en', () => {
    expect(uiLocaleId('en')).toBe('en');
    expect(uiLocaleId('ru')).toBe('ru');
    expect(uiLocaleId('hy')).toBe('hy');
    expect(uiLocaleId('')).toBe('en');
    expect(uiLocaleId(undefined)).toBe('en');
    expect(uiLocaleId('de')).toBe('en');
  });

  it('formats day and month in en, ru and hy', () => {
    expect(formatUiDate(INSTANT, 'MMM d', 'en')).toBe('Oct 21');
    expect(formatUiDate(INSTANT, 'd MMM', 'ru')).toBe('21 окт.');
    expect(formatUiDate(INSTANT, 'd MMMM', 'ru')).toBe('21 октября');
    expect(formatUiDate(INSTANT, 'd MMMM', 'hy')).toBe('21 հոկտեմբերի');
    expect(formatUiDate(INSTANT, 'MMM d', 'hy')).toContain('հոկ');
  });

  it('keeps the existing format patterns working in every language', () => {
    for (const lang of ['en', 'ru', 'hy']) {
      for (const pattern of ['mediumDate', 'medium', 'shortTime', 'longDate', 'MMM y', 'd MMM, H:mm']) {
        expect(formatUiDate(INSTANT, pattern, lang)).not.toBe('');
      }
    }
    expect(formatUiDate(INSTANT, 'mediumDate', 'en')).toBe('Oct 21, 2026');
  });

  it('shows instants in Yerevan time (+04:00)', () => {
    expect(formatUiDate(INSTANT, 'H:mm', 'en')).toBe('14:00');
    // 21:30Z is already the next calendar day in Yerevan
    expect(formatUiDate('2026-10-21T21:30:00Z', 'd MMM, H:mm', 'en')).toBe('22 Oct, 1:30');
  });

  it('does not shift a date-only value', () => {
    expect(formatUiDate('2026-10-21', 'd MMM', 'en')).toBe('21 Oct');
    expect(formatUiDate('2026-10-21', 'mediumDate', 'ru')).toContain('21');
    expect(formatUiDate('2026-01-01', 'yyyy-MM-dd', 'en')).toBe('2026-01-01');
  });

  it('does not shift a local-calendar Date when dateOnly is set', () => {
    const picked = new Date(2026, 9, 21); // local midnight, as a date-picker produces
    expect(formatUiDate(picked, 'EEE d MMM y', 'en', { dateOnly: true })).toBe('Wed 21 Oct 2026');
    expect(formatUiDate(picked, 'EEE d MMM y', 'ru', { dateOnly: true })).toContain('21 окт.');
  });

  it('returns an empty string for empty or unparsable input', () => {
    expect(formatUiDate(null, 'MMM d', 'en')).toBe('');
    expect(formatUiDate(undefined, 'MMM d', 'en')).toBe('');
    expect(formatUiDate('', 'MMM d', 'en')).toBe('');
    expect(formatUiDate('not-a-date', 'MMM d', 'en')).toBe('');
  });
});

describe('formatUiDateRange (ADR-052 follow-up)', () => {
  it('puts the year once at the end, day before month', () => {
    expect(formatUiDateRange('2026-10-17', '2026-10-24', 'en')).toBe('17 Oct – 24 Oct, 2026');
    expect(formatUiDateRange('2026-10-17', '2026-10-24', 'ru')).toBe('17 окт. – 24 окт. 2026');
    const hy = formatUiDateRange('2026-10-17', '2026-10-24', 'hy');
    expect(hy).toMatch(/^17 .+ – 24 .+ 2026$/);
  });

  it('keeps a yearless range yearless', () => {
    expect(formatUiDateRange('2026-10-17', '2026-10-24', 'en', { withYear: false })).toBe('17 Oct – 24 Oct');
    expect(formatUiDateRange('2026-10-17', '2026-10-24', 'ru', { withYear: false })).toBe('17 окт. – 24 окт.');
    expect(formatUiDateRange('2026-10-17', '2026-10-24', 'hy', { withYear: false })).not.toContain('2026');
  });

  it('does not shift date-only values and tolerates a missing end', () => {
    expect(formatUiDateRange('2026-01-01', '2026-01-02', 'en')).toBe('1 Jan – 2 Jan, 2026');
    expect(formatUiDateRange('2026-10-17', null, 'en')).toBe('17 Oct');
  });
});

@Component({
  standalone: true,
  imports: [UiDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="d">{{ value | uiDate: 'd MMM' }}</span
    ><span class="t">{{ value | uiDate: 'H:mm' }}</span
    ><span class="o">{{ '2026-10-21' | uiDate: 'd MMM' }}</span>`,
})
class HostComponent {
  readonly value = INSTANT;
}

describe('UiDatePipe', () => {
  const langChange = new Subject<{ lang: string }>();
  let currentLang = 'en';

  function render() {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: TranslateService,
          useValue: { onLangChange: langChange, getCurrentLang: () => currentLang },
        },
        UiDateService,
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ReturnType<typeof render>, cls: string) =>
    (fixture.nativeElement.querySelector(`.${cls}`) as HTMLElement).textContent;

  beforeEach(() => {
    currentLang = 'en';
  });

  it('renders in the current language, in Yerevan time, without shifting date-only values', () => {
    const fixture = render();
    expect(text(fixture, 'd')).toBe('21 Oct');
    expect(text(fixture, 't')).toBe('14:00');
    expect(text(fixture, 'o')).toBe('21 Oct');
  });

  it('starts in the language that is already active', () => {
    currentLang = 'ru';
    const fixture = render();
    expect(text(fixture, 'd')).toBe('21 окт.');
  });

  it('re-renders when the language is switched, without a reload', async () => {
    const fixture = render();
    expect(text(fixture, 'd')).toBe('21 Oct');

    langChange.next({ lang: 'ru' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(fixture, 'd')).toBe('21 окт.');
    expect(text(fixture, 'o')).toBe('21 окт.');

    langChange.next({ lang: 'hy' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(fixture, 'd')).toContain('հոկ');
  });
});
