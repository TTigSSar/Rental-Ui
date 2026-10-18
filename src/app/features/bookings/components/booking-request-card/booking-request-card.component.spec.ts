import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

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
