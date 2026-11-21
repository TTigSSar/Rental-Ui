import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar.component';

@Component({
  standalone: true,
  imports: [AvatarComponent],
  template: `<app-ui-avatar [name]="name()" [src]="src()" />`,
})
class HostComponent {
  readonly name = signal<string | null>('Ada Lovelace');
  readonly src = signal<string | null>(null);
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host: HTMLElement = fixture.nativeElement;
  const img = (): HTMLImageElement | null => host.querySelector('img');
  const text = (): string => (host.querySelector('.ui-avatar')?.textContent ?? '').trim();
  return { fixture, host, img, text };
}

describe('AvatarComponent picture (ADR-070, F-U12..14)', () => {
  it('without a src shows the initials and no image', () => {
    const { img, text } = setup();
    expect(img()).toBeNull();
    expect(text()).toBe('AL');
  });

  it('with a src renders a decorative, no-referrer, cover image instead of the initials', () => {
    const { fixture, img, text } = setup();
    fixture.componentInstance.src.set('/uploads/avatars/u1/abc.jpg');
    fixture.detectChanges();

    const el = img();
    expect(el).not.toBeNull();
    expect(el!.getAttribute('src')).toBe('/uploads/avatars/u1/abc.jpg');
    expect(el!.getAttribute('alt')).toBe('');
    expect(el!.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(text()).toBe('');
  });

  it('falls back to the initials when the image fails to load (404 / revoked URL)', () => {
    const { fixture, img, text } = setup();
    fixture.componentInstance.src.set('/uploads/avatars/u1/gone.jpg');
    fixture.detectChanges();

    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(img()).toBeNull();
    expect(text()).toBe('AL');
  });

  it('retries with the image when src CHANGES after a failure (the failed flag resets)', () => {
    const { fixture, img } = setup();
    fixture.componentInstance.src.set('/uploads/avatars/u1/gone.jpg');
    fixture.detectChanges();
    img()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(img()).toBeNull();

    fixture.componentInstance.src.set('/uploads/avatars/u1/new.jpg');
    fixture.detectChanges();

    expect(img()?.getAttribute('src')).toBe('/uploads/avatars/u1/new.jpg');
  });

  it('removing the src returns to the initials', () => {
    const { fixture, img, text } = setup();
    fixture.componentInstance.src.set('/uploads/avatars/u1/abc.jpg');
    fixture.detectChanges();
    fixture.componentInstance.src.set(null);
    fixture.detectChanges();

    expect(img()).toBeNull();
    expect(text()).toBe('AL');
  });

  it('keeps the initials-only behaviour of every existing call site (no src)', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name.set(null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ui-avatar')?.textContent?.trim()).toBe('U');
  });
});
