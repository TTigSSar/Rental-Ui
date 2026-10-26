import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { formatUiDate } from '../../../../shared/utils/ui-date';
import { makeBookingRequest } from '../../../../../testing/fixtures';
import { BookingRequestCardComponent } from './booking-request-card.component';

function render(note: string | null) {
  TestBed.configureTestingModule({
    imports: [BookingRequestCardComponent, TranslateModule.forRoot()],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(BookingRequestCardComponent);
  fixture.componentRef.setInput('request', makeBookingRequest({ note }));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BookingRequestCardComponent renter note (ADR-013)', () => {
  it('renders the note when set', () => {
    const el = render('Please bring the box too');
    const note = el.querySelector('.brc__note');
    expect(note).not.toBeNull();
    expect(note?.textContent).toContain('Please bring the box too');
  });

  it('renders the note as text, not markup', () => {
    const el = render('<b>bold</b>');
    expect(el.querySelector('.brc__note b')).toBeNull();
    expect(el.querySelector('.brc__note')?.textContent).toContain('<b>bold</b>');
  });

  it('renders no note block when the note is null', () => {
    expect(render(null).querySelector('.brc__note')).toBeNull();
  });
});

describe('BookingRequestCardComponent range and request age (ADR-052)', () => {
  function renderWith(lang: string, createdAt: string | null) {
    TestBed.configureTestingModule({
      imports: [BookingRequestCardComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', { common: { time: { days: '{{value}}d ago' } } });
    translate.use('en');
    const fixture = TestBed.createComponent(BookingRequestCardComponent);
    fixture.componentRef.setInput(
      'request',
      makeBookingRequest({ startDate: '2026-10-17', endDate: '2026-10-24', createdAt }),
    );
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it('shows a yearless day-month range', () => {
    const el = renderWith('en', null);
    expect(el.textContent).toContain('17 Oct – 24 Oct');
    expect(el.textContent).not.toContain('2026');
  });

  it('shows the localized day-month, not the hard-coded English age, for old requests', () => {
    const old = new Date(Date.now() - 36 * 86_400_000).toISOString();
    const text = renderWith('en', old).querySelector('.brc__time')?.textContent?.trim();
    expect(text).toBe(formatUiDate(old, 'd MMM', 'en'));
    expect(text).toMatch(/^\d{1,2}\s[A-Z][a-z]{2}$/);
    expect(text).not.toContain('36d ago');
  });

  it('localizes a recent request age through the common time keys', () => {
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(renderWith('en', recent).querySelector('.brc__time')?.textContent).toContain('2d ago');
  });
});
