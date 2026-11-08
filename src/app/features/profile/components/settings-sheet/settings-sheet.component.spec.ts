import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { SettingsSheetComponent } from './settings-sheet.component';

function pointer(type: string, clientY: number, timeStamp: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: 'touch' },
    button: { value: 0 },
    clientY: { value: clientY },
    timeStamp: { value: timeStamp },
  });
  return event;
}

function setup(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  TestBed.configureTestingModule({
    imports: [SettingsSheetComponent, TranslateModule.forRoot()],
  });
  const fixture: ComponentFixture<SettingsSheetComponent> =
    TestBed.createComponent(SettingsSheetComponent);
  fixture.componentRef.setInput('title', 'Title');
  fixture.detectChanges();
  const closed = vi.fn();
  fixture.componentInstance.closed.subscribe(closed);
  const el: HTMLElement = fixture.nativeElement;
  const sheet = el.querySelector<HTMLElement>('.ns')!;
  Object.defineProperty(sheet, 'offsetHeight', { value: 600, configurable: true });
  const swipe = (from: HTMLElement, distance: number, ms = 400) => {
    from.dispatchEvent(pointer('pointerdown', 100, 0));
    from.dispatchEvent(pointer('pointermove', 100 + distance, ms / 2));
    fixture.detectChanges();
    const mid = sheet.style.transform;
    from.dispatchEvent(pointer('pointerup', 100 + distance, ms));
    fixture.detectChanges();
    return mid;
  };
  return { fixture, el, sheet, closed, swipe };
}

describe('SettingsSheetComponent swipe down', () => {
  const originalWidth = window.innerWidth;
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true });
  });

  it('follows the finger downward and closes past the threshold', () => {
    const { el, closed, swipe } = setup(390);

    const mid = swipe(el.querySelector<HTMLElement>('.ns__handle-zone')!, 160);

    expect(mid).toBe('translateY(160px)');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('works from the header too', () => {
    const { el, closed, swipe } = setup(390);

    swipe(el.querySelector<HTMLElement>('.ns__head')!, 160);

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closes on a fast short flick', () => {
    const { el, closed, swipe } = setup(390);

    swipe(el.querySelector<HTMLElement>('.ns__head')!, 60, 60);

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('snaps back below the threshold without closing', () => {
    const { el, sheet, closed, swipe } = setup(390);

    swipe(el.querySelector<HTMLElement>('.ns__handle-zone')!, 40);

    expect(closed).not.toHaveBeenCalled();
    expect(sheet.style.transform).toBe('');
    expect(sheet.classList).toContain('ns--snapping');
  });

  it('never moves upward', () => {
    const { el, sheet, closed, swipe } = setup(390);

    const mid = swipe(el.querySelector<HTMLElement>('.ns__head')!, -200);

    expect(mid).toBe('');
    expect(sheet.style.transform).toBe('');
    expect(closed).not.toHaveBeenCalled();
  });

  it('snaps back when the parent keeps the sheet open (close blocked, e.g. saving)', () => {
    // A blocking parent simply ignores `closed`; the sheet must then return to rest.
    const { el, sheet, closed, swipe } = setup(390);

    swipe(el.querySelector<HTMLElement>('.ns__handle-zone')!, 200);

    expect(closed).toHaveBeenCalledTimes(1);
    expect(sheet.style.transform).toBe('');
  });

  it('is ignored at desktop width', () => {
    const { el, sheet, closed, swipe } = setup(1200);

    const mid = swipe(el.querySelector<HTMLElement>('.ns__head')!, 300);

    expect(mid).toBe('');
    expect(sheet.style.transform).toBe('');
    expect(closed).not.toHaveBeenCalled();
  });
});
