import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingsAi } from '../../store/listings.selectors';
import { initialListingsAiState, type ListingsAiState } from '../../store/listings.state';
import { AI_BUDGET_NOTE_MS, AiSearchFieldComponent } from './ai-search-field.component';

async function setup(
  options: {
    url?: string;
    ai?: Partial<ListingsAiState>;
    authenticated?: boolean;
  } = {},
) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([{ path: 'listings', component: AiSearchFieldComponent }]),
      provideMockStore({
        selectors: [
          { selector: selectIsAuthenticated, value: options.authenticated ?? true },
          { selector: selectListingsAi, value: { ...initialListingsAiState, ...options.ai } },
        ],
      }),
    ],
    teardown: { destroyAfterEach: true },
  });
  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');

  const harness = await RouterTestingHarness.create();
  const component = await harness.navigateByUrl(options.url ?? '/listings', AiSearchFieldComponent);
  harness.detectChanges();
  const el = harness.routeNativeElement as HTMLElement;
  const dispatched = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as { type: string });
  return { harness, component, el, store, router: TestBed.inject(Router), dispatched };
}

const q = (el: HTMLElement, sel: string) => el.querySelector(sel) as HTMLElement | null;

function type(el: HTMLElement, value: string) {
  const textarea = q(el, 'textarea') as HTMLTextAreaElement;
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

describe('AiSearchFieldComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('switch off: an ordinary search box that emits the text query; no textarea', async () => {
    const { component, el, dispatched } = await setup();
    const emitted: string[] = [];
    component.queryChange.subscribe((v) => emitted.push(v));

    const input = q(el, 'input[type="search"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(q(el, 'textarea')).toBeNull();

    input.value = 'lego';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toEqual(['lego']);
    expect(dispatched()).toEqual([]);
  });

  it('the switch is a role="switch" with a localised name, off by default', async () => {
    const { el } = await setup();
    const sw = q(el, 'button[role="switch"]')!;
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('turning the switch on remembers the URL params, adds ai=1 and parks the plain q', async () => {
    const { el, router, dispatched } = await setup({
      url: '/listings?q=lego&categoryId=abc&view=map',
    });
    // The host binds the field to `q`; this harness cannot, so mirror it by typing the same text.
    const simple = q(el, 'input[type="search"]') as HTMLInputElement;
    simple.value = 'lego';
    simple.dispatchEvent(new Event('input'));

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(dispatched()).toContainEqual(
      ListingsActions.setAiMode({
        on: true,
        snapshot: { q: 'lego', categoryId: 'abc', view: 'map' },
      }),
    );
    expect(router.url).toContain('ai=1');
    expect(router.url).not.toContain('q=');
    expect(router.url).toContain('categoryId=abc');
    expect(router.url).toContain('view=map');
  });

  it('turning the switch on carries the simple-search text into the description, never into q (design-notes 20)', async () => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        provideMockStore({
          selectors: [
            { selector: selectIsAuthenticated, value: true },
            { selector: selectListingsAi, value: initialListingsAiState },
          ],
        }),
      ],
    });
    const store = TestBed.inject(MockStore);
    vi.spyOn(store, 'dispatch');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=lego');
    const fixture = TestBed.createComponent(AiSearchFieldComponent);
    fixture.componentRef.setInput('query', '  lego bike ');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button[role="switch"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(50);

    const types = (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as { type: string },
    );
    expect(types).toContainEqual(ListingsActions.setAiDescription({ description: 'lego bike' }));
    expect(types.some((a) => a.type === ListingsActions.submitAiSearch.type)).toBe(false);
    expect(router.url).toContain('ai=1');
    expect(router.url).not.toContain('q=');
  });

  it('carries the live typed text even when the host has not caught up yet (no debounce tick)', async () => {
    const { el, dispatched } = await setup({ url: '/listings' });
    const input = q(el, 'input[type="search"]') as HTMLInputElement;
    input.value = 'wooden train set';
    input.dispatchEvent(new Event('input'));

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(dispatched()).toContainEqual(
      ListingsActions.setAiDescription({ description: 'wooden train set' }),
    );
  });

  it('the restore snapshot holds the LIVE typed text as q, so switching off brings it back (design-notes 20)', async () => {
    const { el, dispatched } = await setup({ url: '/listings' });
    const input = q(el, 'input[type="search"]') as HTMLInputElement;
    input.value = 'lego';
    input.dispatchEvent(new Event('input'));

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(dispatched()).toContainEqual(
      ListingsActions.setAiMode({ on: true, snapshot: { q: 'lego' } }),
    );
  });

  it('a cleared simple field leaves no stale q in the snapshot', async () => {
    const { el, dispatched } = await setup({ url: '/listings?q=old' });
    const input = q(el, 'input[type="search"]') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(dispatched()).toContainEqual(ListingsActions.setAiMode({ on: true, snapshot: {} }));
  });

  it('wires the privacy note to the textarea with aria-describedby while it shows (design-notes 11)', async () => {
    const { harness, el } = await setup({ ai: { mode: true } });
    const textarea = q(el, 'textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-describedby')).toBeNull();

    textarea.dispatchEvent(new Event('focus'));
    harness.detectChanges();

    const note = q(el, '.aisf__note')!;
    expect(note.id).toBeTruthy();
    expect(textarea.getAttribute('aria-describedby')).toBe(note.id);
  });

  it('observes the host width for the placeholder fit and disconnects on destroy, without errors', async () => {
    const disconnect = vi.fn();
    const observe = vi.fn();
    class FakeResizeObserver {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      const { harness } = await setup({ ai: { mode: true } });
      await vi.advanceTimersByTimeAsync(10);
      harness.detectChanges();
      expect(observe).toHaveBeenCalledTimes(1);

      TestBed.resetTestingModule();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the observer re-measures only on a real width change, and in the next frame (no ResizeObserver loop)', async () => {
    let callback: () => void = () => undefined;
    class FakeResizeObserver {
      constructor(cb: () => void) {
        callback = cb;
      }
      observe = vi.fn();
      disconnect = vi.fn();
    }
    const frames: (() => void)[] = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    try {
      const { harness, el } = await setup({ ai: { mode: true } });
      await vi.advanceTimersByTimeAsync(10);
      harness.detectChanges();
      const textarea = q(el, 'textarea') as HTMLTextAreaElement;
      let width = 300;
      let measures = 0;
      Object.defineProperty(textarea, 'clientWidth', { get: () => width, configurable: true });
      Object.defineProperty(textarea, 'scrollHeight', {
        get: () => {
          measures++;
          return 24;
        },
        configurable: true,
      });

      callback(); // first sighting of width 300: measure is deferred, not done inside the callback
      expect(measures).toBe(0);
      frames.splice(0).forEach((f) => f());
      expect(measures).toBe(1);

      callback(); // same width: nothing scheduled
      expect(frames).toHaveLength(0);

      width = 200;
      callback();
      expect(measures).toBe(1);
      frames.splice(0).forEach((f) => f());
      expect(measures).toBe(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('turning the switch on with an empty simple field keeps the stored description', async () => {
    const { el, dispatched } = await setup({ url: '/listings', ai: { description: 'stored' } });

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(dispatched().some((a) => a.type === ListingsActions.setAiDescription.type)).toBe(false);
  });

  it('turning it off restores q, filters and view exactly as they were, and drops ai', async () => {
    const { el, router } = await setup({
      url: '/listings?ai=1&categoryId=ai-cat&maxPrice=3000',
      ai: { mode: true, snapshot: { q: 'lego', categoryId: 'abc', view: 'map' } },
    });

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).toContain('q=lego');
    expect(router.url).toContain('categoryId=abc');
    expect(router.url).toContain('view=map');
    expect(router.url).not.toContain('ai=');
    expect(router.url).not.toContain('maxPrice');
  });

  it('turning it off with no snapshot (page opened on ?ai=1) only drops ai', async () => {
    const { el, router } = await setup({
      url: '/listings?ai=1&categoryId=abc',
      ai: { mode: true },
    });

    q(el, 'button[role="switch"]')!.click();
    await vi.advanceTimersByTimeAsync(50);

    expect(router.url).toContain('categoryId=abc');
    expect(router.url).not.toContain('ai=');
  });

  describe('switch on', () => {
    it('shows the textarea; typing goes to the description, never to the text query', async () => {
      const { component, el, dispatched } = await setup({ ai: { mode: true } });
      const queries: string[] = [];
      component.queryChange.subscribe((v) => queries.push(v));

      expect(q(el, 'textarea')).not.toBeNull();
      type(el, 'a balance bike');

      expect(dispatched()).toContainEqual(
        ListingsActions.setAiDescription({ description: 'a balance bike' }),
      );
      expect(queries).toEqual([]);
    });

    it('Enter submits the trimmed description; Shift+Enter does not', async () => {
      const { el, dispatched } = await setup({
        ai: { mode: true, description: '  a balance bike ' },
      });
      const textarea = q(el, 'textarea')!;

      textarea.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true }),
      );
      expect(dispatched().some((a) => a.type === ListingsActions.submitAiSearch.type)).toBe(false);

      const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      textarea.dispatchEvent(enter);

      expect(enter.defaultPrevented).toBe(true);
      expect(dispatched()).toContainEqual(
        ListingsActions.submitAiSearch({ description: 'a balance bike' }),
      );
    });

    it('the round submit button appears with text and submits', async () => {
      const { harness, el, dispatched } = await setup({ ai: { mode: true, description: 'bike' } });
      harness.detectChanges();

      const submit = q(el, '.aisf__submit')!;
      expect(submit).not.toBeNull();
      submit.click();

      expect(dispatched()).toContainEqual(ListingsActions.submitAiSearch({ description: 'bike' }));
    });

    it('an empty description cannot be submitted (no submit button, Enter is a no-op)', async () => {
      const { el, dispatched } = await setup({ ai: { mode: true, description: '   ' } });

      expect(q(el, '.aisf__submit')).toBeNull();
      q(el, 'textarea')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }),
      );

      expect(dispatched().some((a) => a.type === ListingsActions.submitAiSearch.type)).toBe(false);
    });

    it('a guest asks the host for the sign-in dialog and sends nothing; the description is kept', async () => {
      const { component, el, dispatched } = await setup({
        ai: { mode: true, description: 'bike' },
        authenticated: false,
      });
      let asked = 0;
      component.authRequired.subscribe(() => asked++);

      q(el, 'textarea')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }),
      );

      expect(asked).toBe(1);
      expect(dispatched().some((a) => a.type === ListingsActions.submitAiSearch.type)).toBe(false);
    });

    it('the privacy note shows only while the field has focus (typing), not on the results', async () => {
      const { harness, el } = await setup({
        ai: { mode: true, description: 'bike', hasSearched: true },
      });
      const textarea = q(el, 'textarea');
      // collapsed after a search (bar layout): no textarea, no note
      expect(textarea).toBeNull();
      expect(q(el, '.aisf__note')).toBeNull();

      (q(el, '.aisf__collapsed') as HTMLButtonElement).click();
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(10);
      harness.detectChanges();
      const expanded = q(el, 'textarea') as HTMLTextAreaElement;
      expanded.dispatchEvent(new Event('focus'));
      harness.detectChanges();
      expect(q(el, '.aisf__note')).not.toBeNull();

      expanded.dispatchEvent(new Event('blur'));
      harness.detectChanges();
      expect(q(el, '.aisf__note')).toBeNull();
    });

    it('collapses to a one-line button after a search (mobile bar)', async () => {
      const { el } = await setup({ ai: { mode: true, description: 'bike', hasSearched: true } });
      expect(q(el, '.aisf__collapsed')?.textContent?.trim()).toBe('bike');
      expect(q(el, 'textarea')).toBeNull();
    });

    it('stays expanded in the desktop block layout after a search', async () => {
      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [
          provideRouter([]),
          provideMockStore({
            selectors: [
              { selector: selectIsAuthenticated, value: true },
              {
                selector: selectListingsAi,
                value: {
                  ...initialListingsAiState,
                  mode: true,
                  description: 'bike',
                  hasSearched: true,
                },
              },
            ],
          }),
        ],
      });
      const fixture = TestBed.createComponent(AiSearchFieldComponent);
      fixture.componentRef.setInput('layout', 'block');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('textarea')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.aisf__collapsed')).toBeNull();
    });

    it('Esc leaves the field', async () => {
      const { el } = await setup({ ai: { mode: true } });
      const textarea = q(el, 'textarea') as HTMLTextAreaElement;
      textarea.focus();
      const blur = vi.spyOn(textarea, 'blur');

      const esc = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      textarea.dispatchEvent(esc);

      expect(blur).toHaveBeenCalled();
    });

    it('shows another rejected search (e.g. an invalid description) under the field', async () => {
      const { el } = await setup({
        ai: { mode: true, error: 'Describe it', errorCode: 'ai_search.invalid_description' },
      });
      expect(q(el, '.aisf__error')?.textContent).toContain('Describe it');
    });

    it('the rate limit is a warn notice under the field, by errorCode, without the server text', async () => {
      const { el } = await setup({
        ai: { mode: true, description: 'a bike', error: 'Raw prose', errorCode: 'ai_search.rate_limited' },
      });

      const notice = q(el, 'app-ai-notice .msg')!;
      expect(notice.classList.contains('msg--warn')).toBe(true);
      expect(notice.textContent).toContain('listings.ai.rateLimited');
      expect(el.textContent).not.toContain('Raw prose');
      expect(q(el, '.aisf__error')).toBeNull();
      // the description stays in the field
      expect((q(el, 'textarea') as HTMLTextAreaElement).value).toBe('a bike');
    });

    it('the daily limit is the same warn notice with its own text, by errorCode', async () => {
      const { el } = await setup({
        ai: { mode: true, description: 'a bike', error: 'Raw prose', errorCode: 'ai_search.daily_limit' },
      });

      const notice = q(el, 'app-ai-notice .msg')!;
      expect(notice.classList.contains('msg--warn')).toBe(true);
      expect(notice.textContent).toContain('errors.aiSearchDailyLimit');
      expect(notice.textContent).not.toContain('listings.ai.rateLimited');
      expect(el.textContent).not.toContain('Raw prose');
      expect(q(el, '.aisf__error')).toBeNull();
      expect((q(el, 'textarea') as HTMLTextAreaElement).value).toBe('a bike');
    });
  });

  describe('daily budget used up', () => {
    const SPENT = { aiStatus: { available: false } };

    it('mobile: tapping the aria-disabled switch shows a Note for ~5 s; AI stays off', async () => {
      const { harness, el, dispatched, router } = await setup({ ai: SPENT });
      const sw = q(el, 'button[role="switch"]')!;
      expect(sw.getAttribute('aria-disabled')).toBe('true');
      expect(q(el, '.aisf__note')).toBeNull();

      sw.click();
      harness.detectChanges();

      const note = q(el, '.aisf__note')!;
      expect(note.getAttribute('role')).toBe('status');
      expect(note.textContent).toContain('listings.ai.budgetSpent');
      expect(dispatched().some((a) => a.type === ListingsActions.setAiMode.type)).toBe(false);
      expect(router.url).not.toContain('ai=1');

      await vi.advanceTimersByTimeAsync(AI_BUDGET_NOTE_MS + 10);
      harness.detectChanges();
      expect(q(el, '.aisf__note')).toBeNull();
    });

    it('mobile: no tooltip is rendered (the Note replaces it)', async () => {
      const { el } = await setup({ ai: SPENT });
      expect(q(el, '[role="tooltip"]')).toBeNull();
    });

    it('desktop (block layout): a tooltip is wired through aria-describedby and no Note appears', async () => {
      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [
          provideRouter([]),
          provideMockStore({
            selectors: [
              { selector: selectIsAuthenticated, value: true },
              { selector: selectListingsAi, value: { ...initialListingsAiState, ...SPENT } },
            ],
          }),
        ],
      });
      const fixture = TestBed.createComponent(AiSearchFieldComponent);
      fixture.componentRef.setInput('layout', 'block');
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      const sw = q(el, 'button[role="switch"]')!;
      const tip = q(el, '[role="tooltip"]')!;
      expect(sw.getAttribute('aria-describedby')).toBe(tip.id);
      expect(tip.textContent).toContain('listings.ai.budgetSpent');

      sw.click();
      fixture.detectChanges();
      expect(q(el, '.aisf__note')).toBeNull();
    });

    it('the field is a plain text search', async () => {
      const { el } = await setup({ ai: SPENT });
      expect(q(el, 'input[type="search"]')).not.toBeNull();
      expect(q(el, 'textarea')).toBeNull();
    });

    it('while the status is unknown or available the switch is usable', async () => {
      const unknown = await setup();
      expect(q(unknown.el, 'button[role="switch"]')!.hasAttribute('aria-disabled')).toBe(false);
    });
  });

  describe('focusEnd (no-results "Edit description")', () => {
    it('focuses the textarea with the caret at the end', async () => {
      const { component, el } = await setup({ ai: { mode: true, description: 'a balance bike' } });
      const textarea = q(el, 'textarea') as HTMLTextAreaElement;

      component.focusEnd();

      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe('a balance bike'.length);
      expect(textarea.selectionEnd).toBe('a balance bike'.length);
    });

    it('expands the collapsed one-line state first (mobile)', async () => {
      const { harness, component, el } = await setup({
        ai: { mode: true, hasSearched: true, description: 'a balance bike' },
      });
      expect(q(el, '.aisf__collapsed')).not.toBeNull();

      component.focusEnd();
      harness.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      harness.detectChanges();

      expect(q(el, '.aisf__collapsed')).toBeNull();
      expect(document.activeElement).toBe(q(el, 'textarea'));
    });
  });
});
