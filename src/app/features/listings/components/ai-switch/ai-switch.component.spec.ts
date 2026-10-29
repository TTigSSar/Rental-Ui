import { TestBed } from '@angular/core/testing';

import { AiSwitchComponent } from './ai-switch.component';

function setup(
  inputs: { checked?: boolean; ariaLabel?: string; unavailable?: boolean; tooltip?: string } = {},
) {
  const fixture = TestBed.createComponent(AiSwitchComponent);
  if (inputs.checked !== undefined) fixture.componentRef.setInput('checked', inputs.checked);
  if (inputs.ariaLabel !== undefined) fixture.componentRef.setInput('ariaLabel', inputs.ariaLabel);
  if (inputs.unavailable !== undefined) fixture.componentRef.setInput('unavailable', inputs.unavailable);
  if (inputs.tooltip !== undefined) fixture.componentRef.setInput('tooltip', inputs.tooltip);
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  return { fixture, button };
}

describe('AiSwitchComponent', () => {
  it('is a switch: role="switch" with a localised accessible name', () => {
    const { button } = setup({ ariaLabel: 'Search by description' });

    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-label')).toBe('Search by description');
  });

  it('reflects the state in aria-checked and in the on class', () => {
    const off = setup({ checked: false });
    expect(off.button.getAttribute('aria-checked')).toBe('false');
    expect(off.button.classList.contains('ai-switch--on')).toBe(false);

    const on = setup({ checked: true });
    expect(on.button.getAttribute('aria-checked')).toBe('true');
    expect(on.button.classList.contains('ai-switch--on')).toBe(true);
  });

  it('emits the opposite state when clicked', () => {
    const { fixture, button } = setup({ checked: false });
    const emitted: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((v) => emitted.push(v));

    button.click();
    fixture.componentRef.setInput('checked', true);
    fixture.detectChanges();
    button.click();

    expect(emitted).toEqual([true, false]);
  });

  it('shows the label "AI"', () => {
    const { button } = setup();
    expect(button.textContent?.trim()).toBe('AI');
  });

  describe('unavailable (daily budget used up)', () => {
    it('is aria-disabled but NOT disabled, so it stays focusable; it reads as off', () => {
      const { button } = setup({ checked: true, unavailable: true });

      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-checked')).toBe('false');
      expect(button.classList.contains('ai-switch--dis')).toBe(true);
      expect(button.classList.contains('ai-switch--on')).toBe(false);
    });

    it('never toggles; a tap emits `blocked`', () => {
      const { fixture, button } = setup({ unavailable: true });
      const toggled: boolean[] = [];
      let blocked = 0;
      fixture.componentInstance.toggled.subscribe((v) => toggled.push(v));
      fixture.componentInstance.blocked.subscribe(() => blocked++);

      button.click();

      expect(toggled).toEqual([]);
      expect(blocked).toBe(1);
    });

    it('with a tooltip: described by it, hidden until hover or keyboard focus, closed by Esc', () => {
      const { fixture, button } = setup({ unavailable: true, tooltip: 'AI search is unavailable today.' });
      const tip = fixture.nativeElement.querySelector('[role="tooltip"]') as HTMLElement;

      expect(button.getAttribute('aria-describedby')).toBe(tip.id);
      expect(tip.hidden).toBe(true);

      button.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      expect(tip.hidden).toBe(false);
      expect(tip.textContent).toContain('unavailable today');

      button.dispatchEvent(new Event('mouseleave'));
      fixture.detectChanges();
      expect(tip.hidden).toBe(true);

      button.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      expect(tip.hidden).toBe(false);

      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(tip.hidden).toBe(true);

      button.dispatchEvent(new Event('blur'));
      button.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      expect(tip.hidden).toBe(false);
    });

    it('without a tooltip (mobile) nothing is rendered or referenced', () => {
      const { fixture, button } = setup({ unavailable: true });
      expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
      expect(button.hasAttribute('aria-describedby')).toBe(false);
    });

    it('an available switch has no aria-disabled and no tooltip', () => {
      const { fixture, button } = setup({ tooltip: 'x' });
      expect(button.hasAttribute('aria-disabled')).toBe(false);
      expect(fixture.nativeElement.querySelector('[role="tooltip"]')).toBeNull();
    });
  });
});
