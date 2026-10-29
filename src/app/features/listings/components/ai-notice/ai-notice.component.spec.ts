import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AiNoticeComponent } from './ai-notice.component';

@Component({
  standalone: true,
  imports: [AiNoticeComponent],
  template: `<app-ai-notice [kind]="kind">Hello notice</app-ai-notice>`,
})
class HostComponent {
  kind: 'info' | 'warn' = 'info';
}

function render(kind: 'info' | 'warn') {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.kind = kind;
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('.msg') as HTMLElement;
}

describe('AiNoticeComponent', () => {
  it('info: a polite status with the info icon and the projected text', () => {
    const msg = render('info');

    expect(msg.getAttribute('role')).toBe('status');
    expect(msg.getAttribute('aria-live')).toBe('polite');
    expect(msg.classList.contains('msg--info')).toBe(true);
    expect(msg.querySelector('.pi-info-circle')).not.toBeNull();
    expect(msg.textContent).toContain('Hello notice');
  });

  it('warn: the warning icon and the warn tint class', () => {
    const msg = render('warn');

    expect(msg.classList.contains('msg--warn')).toBe(true);
    expect(msg.classList.contains('msg--info')).toBe(false);
    expect(msg.querySelector('.pi-exclamation-triangle')).not.toBeNull();
  });
});
