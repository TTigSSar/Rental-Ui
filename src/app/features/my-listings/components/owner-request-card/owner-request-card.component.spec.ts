import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import type { OwnerBookingRequest, OwnerRequestDecision } from '../../models/owner-listing.model';
import { OwnerRequestCardComponent } from './owner-request-card.component';

function makeRequest(overrides: Partial<OwnerBookingRequest> = {}): OwnerBookingRequest {
  return {
    id: 'booking-1',
    renter: {
      id: 'renter-1',
      firstName: 'Anahit',
      lastName: 'Hayrapetyan',
      avatarUrl: null,
      rating: 4.8,
      rentalsCount: 3,
    },
    requestedAt: new Date().toISOString(),
    startDate: '2026-07-01',
    endDate: '2026-07-03',
    ownerEarnings: 15000,
    decision: 'pending',
    ...overrides,
  };
}

describe('OwnerRequestCardComponent', () => {
  let fixture: ComponentFixture<OwnerRequestCardComponent>;

  async function setup(decision: OwnerRequestDecision): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OwnerRequestCardComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    }).compileComponents();
    // The real i18n bundle isn't wired into unit tests — load just the strings this spec
    // asserts on, mirroring booking-details-page.chat.spec.ts's setup.
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation(
      'en',
      {
        myListings: {
          ownerView: {
            requests: {
              declined: 'Declined',
              awaitingHandover: 'Awaiting handover',
              pickedUp: 'Picked up',
              returned: 'Returned',
              viewBooking: 'View booking',
              message: 'Message {{name}}',
            },
          },
        },
      },
      true,
    );
    translate.use('en');
    fixture = TestBed.createComponent(OwnerRequestCardComponent);
    fixture.componentRef.setInput('request', makeRequest({ decision }));
    fixture.detectChanges();
  }

  function statusPill(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.orc__status');
  }

  function viewBookingButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.orc__decided-actions p-button:first-child button');
  }

  it('shows the pending accept/decline actions and no status pill for a Pending request', async () => {
    await setup('pending');
    expect(statusPill()).toBeNull();
    expect(fixture.nativeElement.querySelector('.orc__actions')).not.toBeNull();
  });

  it('shows "Awaiting handover" for an Approved request', async () => {
    await setup('approved');
    expect(statusPill()?.textContent).toContain('Awaiting handover');
    expect(statusPill()?.className).toContain('orc__status--approved');
  });

  it('shows "Picked up" for an Active request', async () => {
    await setup('active');
    expect(statusPill()?.textContent).toContain('Picked up');
    expect(statusPill()?.className).toContain('orc__status--active');
  });

  it('shows "Returned" for a Completed request', async () => {
    await setup('completed');
    expect(statusPill()?.textContent).toContain('Returned');
    expect(statusPill()?.className).toContain('orc__status--completed');
  });

  it('shows "Declined" and no View booking button for a declined request', async () => {
    await setup('declined');
    expect(statusPill()?.textContent).toContain('Declined');
    expect(fixture.nativeElement.querySelector('.orc__decided-actions')).toBeNull();
  });

  it.each<OwnerRequestDecision>(['approved', 'active', 'completed'])(
    'renders a "View booking" button for a %s request',
    async (decision) => {
      await setup(decision);
      const button = viewBookingButton();
      expect(button).not.toBeNull();
      expect(button?.textContent).toContain('View booking');
    },
  );

  it('navigates to /bookings/:id when "View booking" is clicked', async () => {
    await setup('active');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    viewBookingButton()?.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/bookings', 'booking-1']);
  });
});
