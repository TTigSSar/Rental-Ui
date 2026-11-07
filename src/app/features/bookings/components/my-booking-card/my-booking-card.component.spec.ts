import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { makeMyBooking } from '../../../../../testing/fixtures';
import type { MyBooking } from '../../models/booking.model';
import { MyBookingCardComponent } from './my-booking-card.component';

function render(overrides: Partial<MyBooking>): HTMLElement {
  TestBed.configureTestingModule({
    imports: [MyBookingCardComponent, TranslateModule.forRoot()],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(MyBookingCardComponent);
  fixture.componentRef.setInput('booking', makeMyBooking(overrides));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MyBookingCardComponent — deleted owner (ADR-056)', () => {
  it('shows the shared avatar and "Deleted user" instead of the owner name', () => {
    const host = render({ ownerFirstName: '', ownerLastName: '', ownerIsDeleted: true });
    const owner = host.querySelector('.mbc__owner');
    expect(owner?.querySelector('app-deleted-user-avatar')).not.toBeNull();
    expect(owner?.querySelector('app-deleted-user-name')).not.toBeNull();
  });

  it('keeps the owner initial chip and short name for a live owner', () => {
    const host = render({});
    expect(host.querySelector('.mbc__owner app-deleted-user-avatar')).toBeNull();
    expect(host.querySelector('.mbc__owner')?.textContent).toContain('Owen O.');
  });
});
