import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { BookingRejectDialogComponent } from './booking-reject-dialog.component';

function createFixture() {
  TestBed.configureTestingModule({
    imports: [BookingRejectDialogComponent, TranslateModule.forRoot()],
  });
  return TestBed.createComponent(BookingRejectDialogComponent);
}

describe('BookingRejectDialogComponent', () => {
  it('defaults to the first reason code with an empty note', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      selectedReason: () => string;
      otherText: () => string;
    };
    expect(instance.selectedReason()).toBe('dates_unavailable');
    expect(instance.otherText()).toBe('');
  });

  it('gives the reason radio group a programmatic group name via fieldset/legend', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    // `appendTo="body"` portals the dialog's content onto `document.body`, not under
    // `fixture.nativeElement` — query the document, not the fixture.
    const fieldset: HTMLFieldSetElement | null = document.querySelector(
      '.booking-reject__fieldset',
    );
    expect(fieldset).not.toBeNull();

    const legend = fieldset!.querySelector('legend');
    expect(legend).not.toBeNull();
    expect(legend!.textContent?.trim()).not.toBe('');

    const radios = fieldset!.querySelectorAll('input[type="radio"][name="rejectReason"]');
    expect(radios.length).toBe(4);
  });

  it('emits confirmed with the reason code for a known reason', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    const instance = fixture.componentInstance as unknown as {
      onReasonChange: (code: string) => void;
      confirm: () => void;
    };
    instance.onReasonChange('item_unavailable');
    instance.confirm();

    expect(confirmed).toHaveBeenCalledWith({ reason: 'item_unavailable' });
  });

  it('requires non-empty free text before "other" can be confirmed', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      onReasonChange: (code: string) => void;
      onOtherInput: (event: Event) => void;
      confirm: () => void;
    };
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    instance.onReasonChange('other');
    fixture.detectChanges();

    // `appendTo="body"` portals the dialog's content onto `document.body`, not under
    // `fixture.nativeElement` — query the document, not the fixture.
    const textarea: HTMLTextAreaElement | null = document.querySelector('.booking-reject__note');
    expect(textarea).not.toBeNull();

    // The textarea must have a programmatic accessible name (WCAG 3.3.2 / 4.1.2) —
    // a placeholder alone is not one, and it disappears once the user types.
    const textareaLabel: HTMLLabelElement | null = document.querySelector(
      `label[for="${textarea!.id}"]`,
    );
    expect(textarea!.id).toBeTruthy();
    expect(textareaLabel).not.toBeNull();
    expect(textareaLabel!.textContent?.trim()).not.toBe('');

    const confirmButton: HTMLButtonElement | null =
      Array.from(document.querySelectorAll<HTMLButtonElement>('p-button button')).at(-1) ?? null;
    expect(confirmButton).not.toBeNull();
    expect(confirmButton!.disabled).toBe(true);

    instance.onOtherInput({ target: { value: '  a real reason  ' } } as unknown as Event);
    fixture.detectChanges();
    expect(confirmButton!.disabled).toBe(false);

    instance.confirm();

    expect(confirmed).toHaveBeenCalledWith({ reason: 'a real reason' });
  });

  it('emits reason: null for "other" with only whitespace', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      onReasonChange: (code: string) => void;
      onOtherInput: (event: Event) => void;
      confirm: () => void;
    };
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);

    instance.onReasonChange('other');
    instance.onOtherInput({ target: { value: '   ' } } as unknown as Event);
    instance.confirm();

    expect(confirmed).toHaveBeenCalledWith({ reason: null });
  });

  it('emits cancelled when the dialog is dismissed without confirming', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (fixture.componentInstance as unknown as { cancel: () => void }).cancel();
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('resets the selection every time visible flips back to true', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      onReasonChange: (code: string) => void;
      onOtherInput: (event: Event) => void;
      selectedReason: () => string;
      otherText: () => string;
    };
    instance.onReasonChange('other');
    instance.onOtherInput({ target: { value: 'leftover text' } } as unknown as Event);
    expect(instance.selectedReason()).toBe('other');

    fixture.componentRef.setInput('visible', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();

    expect(instance.selectedReason()).toBe('dates_unavailable');
    expect(instance.otherText()).toBe('');
  });

  describe('focus restore (a11y)', () => {
    let extraNodes: HTMLElement[] = [];

    afterEach(() => {
      for (const node of extraNodes) {
        node.remove();
      }
      extraNodes = [];
    });

    /** A standalone real trigger button, appended to `document.body` and focused directly
     *  (not via `.click()`) so the test controls focus precisely rather than depending on
     *  jsdom's click-then-focus behaviour. Mirrors "whatever the caller had focused right
     *  before setting `[visible]=true`" — this spec has no real parent page, so the trigger
     *  is synthesized here instead. */
    function appendFocusedTrigger(): HTMLButtonElement {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.textContent = 'Decline';
      document.body.appendChild(trigger);
      extraNodes.push(trigger);
      trigger.focus();
      return trigger;
    }

    it('returns focus to the trigger after cancel', async () => {
      const fixture = createFixture();
      const trigger = appendFocusedTrigger();
      expect(document.activeElement).toBe(trigger);

      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      (fixture.componentInstance as unknown as { cancel: () => void }).cancel();
      // The parent reacts to `cancelled` by flipping `visible` back to false — simulated
      // here since this spec has no real parent host.
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(trigger);
    });

    it('returns focus to the trigger after confirm', async () => {
      const fixture = createFixture();
      const trigger = appendFocusedTrigger();

      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      (fixture.componentInstance as unknown as { confirm: () => void }).confirm();
      // The parent reacts to `confirmed` by flipping `visible` back to false too — the same
      // exit path as cancel, per the class doc comment.
      fixture.componentRef.setInput('visible', false);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(trigger);
    });

    it('does not throw when the trigger was removed from the DOM before close, and falls back sensibly', async () => {
      // The real app shell always has a persistent `<main>` landmark (`app.html`) — recreate
      // it here since this spec mounts the dialog standalone, with no app shell around it.
      const main = document.createElement('main');
      document.body.appendChild(main);
      extraNodes.push(main);

      const fixture = createFixture();
      const trigger = appendFocusedTrigger();

      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      // Simulates the real "footer swapped away" case: the trigger disappears entirely
      // while the dialog is open (e.g. the booking's status changed underneath it).
      trigger.remove();

      expect(() => {
        (fixture.componentInstance as unknown as { cancel: () => void }).cancel();
        fixture.componentRef.setInput('visible', false);
        fixture.detectChanges();
      }).not.toThrow();
      await fixture.whenStable();

      // Falls back to the app shell's persistent `<main>` landmark rather than leaving
      // focus on `<body>` (the original bug) or throwing.
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(main);
    });

    it('falls back to a focusable <body> when even <main> is unavailable, and does not throw', async () => {
      const fixture = createFixture();
      const trigger = appendFocusedTrigger();

      fixture.componentRef.setInput('visible', true);
      fixture.detectChanges();
      await fixture.whenStable();

      trigger.remove();

      expect(() => {
        (fixture.componentInstance as unknown as { confirm: () => void }).confirm();
        fixture.componentRef.setInput('visible', false);
        fixture.detectChanges();
      }).not.toThrow();
      await fixture.whenStable();

      expect(document.activeElement).toBe(document.body);
    });
  });
});
