import { TestBed } from '@angular/core/testing';

import { AiSwitchComponent } from './ai-switch.component';

function setup(inputs: { checked?: boolean; ariaLabel?: string } = {}) {
  const fixture = TestBed.createComponent(AiSwitchComponent);
  if (inputs.checked !== undefined) fixture.componentRef.setInput('checked', inputs.checked);
  if (inputs.ariaLabel !== undefined) fixture.componentRef.setInput('ariaLabel', inputs.ariaLabel);
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
});
