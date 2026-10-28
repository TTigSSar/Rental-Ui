import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { MeetingPointBubbleComponent } from './meeting-point-bubble.component';

function render(inputs: Record<string, unknown>) {
  TestBed.configureTestingModule({
    imports: [MeetingPointBubbleComponent, TranslateModule.forRoot()],
  });
  const fixture = TestBed.createComponent(MeetingPointBubbleComponent);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MeetingPointBubbleComponent', () => {
  it("shows the Owner's home subtitle on a home share", () => {
    const host = render({ latitude: 40.18, longitude: 44.51, kind: 'home' });
    expect(host.querySelector('.mp-bubble__subtitle')?.textContent?.trim()).toBe(
      'chat.meetingPoint.ownerHome',
    );
  });

  it('has no subtitle for another place', () => {
    const host = render({ latitude: 40.18, longitude: 44.51, kind: 'other' });
    expect(host.querySelector('.mp-bubble__subtitle')).toBeNull();
    expect(host.querySelector('.mp-bubble__title')?.textContent?.trim()).toBe(
      'chat.meetingPoint.title',
    );
  });

  it('links to Google Maps in a new tab without leaking the opener', () => {
    const host = render({ latitude: 40.1811, longitude: 44.5136, kind: 'other' });
    const link = host.querySelector<HTMLAnchorElement>('a.mp-bubble__link');
    expect(link?.getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=40.1811,44.5136',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.querySelector('.pi-external-link')).not.toBeNull();
  });

  it('never renders the coordinates as text', () => {
    const host = render({ latitude: 40.1811, longitude: 44.5136, kind: 'home' });
    expect(host.textContent).not.toContain('40.18');
    expect(host.textContent).not.toContain('44.51');
  });

  it('is dimmed and inert (no href, not focusable) while the share is still sending', () => {
    const host = render({ kind: 'home', mine: true, state: 'sending' });
    const link = host.querySelector<HTMLAnchorElement>('a.mp-bubble__link');
    expect(host.querySelector('.mp-bubble--idle')).not.toBeNull();
    expect(host.querySelector('.mp-bubble--mine')).not.toBeNull();
    expect(link?.hasAttribute('href')).toBe(false);
    expect(link?.getAttribute('tabindex')).toBe('-1');
    expect(link?.getAttribute('aria-disabled')).toBe('true');
  });
});
