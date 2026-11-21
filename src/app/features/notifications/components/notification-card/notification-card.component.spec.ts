import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { NotificationItem } from '../../models/notification.model';
import { NotificationCardComponent } from './notification-card.component';

function item(actor: Partial<NotificationItem['actor']>): NotificationItem {
  return {
    id: 'n1',
    kind: 'request',
    category: 'booking',
    title: 'New request',
    body: 'Ada wants to book your toy',
    meta: null,
    createdAt: '2026-11-21T10:00:00Z',
    read: false,
    urgent: false,
    actor: {
      name: 'Ada Lovelace',
      avatarUrl: null,
      verified: false,
      system: false,
      systemIcon: null,
      ...actor,
    },
    toy: null,
    primaryAction: null,
    secondaryAction: null,
  };
}

function render(n: NotificationItem) {
  TestBed.configureTestingModule({ imports: [NotificationCardComponent, TranslateModule.forRoot()] });
  const fixture = TestBed.createComponent(NotificationCardComponent);
  fixture.componentRef.setInput('notification', n);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('NotificationCardComponent actor avatar (ADR-070, F-U28)', () => {
  it('shows the actor photo through app-ui-avatar (decorative, no-referrer)', () => {
    const { host } = render(item({ avatarUrl: '/uploads/avatars/u2/abc.jpg' }));
    const img = host.querySelector('.notif-card__avatar img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/uploads/avatars/u2/abc.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('a stale snapshot URL that 404s falls back to initials, never a broken image', () => {
    const { fixture, host } = render(item({ avatarUrl: '/uploads/avatars/u2/replaced.jpg' }));

    host.querySelector('.notif-card__avatar img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(host.querySelector('.notif-card__avatar img')).toBeNull();
    expect(host.querySelector('.notif-card__avatar .ui-avatar')?.textContent?.trim()).toBe('AL');
  });

  it('no avatar URL: initials', () => {
    const { host } = render(item({ avatarUrl: null }));
    expect(host.querySelector('.notif-card__avatar .ui-avatar')?.textContent?.trim()).toBe('AL');
  });

  it('system senders keep the icon chip', () => {
    const { host } = render(item({ system: true, systemIcon: 'shield' }));
    expect(host.querySelector('.notif-card__system-chip')).not.toBeNull();
    expect(host.querySelector('.notif-card__avatar img')).toBeNull();
  });
});
