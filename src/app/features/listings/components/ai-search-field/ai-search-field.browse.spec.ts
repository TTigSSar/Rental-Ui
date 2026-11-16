import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingsAi } from '../../store/listings.selectors';
import { initialListingsAiState, type ListingsAiState } from '../../store/listings.state';
import { AiSearchFieldComponent } from './ai-search-field.component';

/** Browse Redesign Stage 1 `.bsearch` layout (`layout="browse"`). */
function setup(options: { ai?: Partial<ListingsAiState>; authenticated?: boolean; query?: string } = {}) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideRouter([]),
      provideMockStore({
        selectors: [
          { selector: selectIsAuthenticated, value: options.authenticated ?? true },
          { selector: selectListingsAi, value: { ...initialListingsAiState, ...options.ai } },
        ],
      }),
    ],
  });
  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');
  const fixture = TestBed.createComponent(AiSearchFieldComponent);
  fixture.componentRef.setInput('layout', 'browse');
  fixture.componentRef.setInput('query', options.query ?? '');
  const emitted: string[] = [];
  const auth: number[] = [];
  fixture.componentInstance.queryChange.subscribe((v) => emitted.push(v));
  fixture.componentInstance.authRequired.subscribe(() => auth.push(1));
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const dispatched = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as { type: string });
  const q = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
  return { fixture, el, q, store, emitted, auth, dispatched };
}

describe('AiSearchFieldComponent — browse layout (.bsearch)', () => {
  it('renders the bar in design order: icon, input, Smart search switch, Search button', () => {
    const { el, q } = setup();

    const children = Array.from(el.querySelector('form.bsearch')!.children).map((c) => c.tagName.toLowerCase() + '.' + (c.className.split(' ')[0] ?? ''));
    expect(children).toEqual(['app-icon.bsearch__icon', 'input.bsearch__input', 'button.aitg', 'button.bsearch__submit']);
    expect(q('.aitg')!.getAttribute('role')).toBe('switch');
    expect(q('.aitg')!.getAttribute('aria-checked')).toBe('false');
    expect(q('.aitg')!.textContent).toContain('listings.browse.smartSearch');
    expect(q('.bsearch__submit')!.textContent).toContain('listings.browse.search');
    expect(q('.bsearch--ai')).toBeNull();
  });

  it('plain mode: typing emits the text query and shows the clear x only when there is text', () => {
    const { fixture, q, emitted } = setup();
    expect(q('.bsearch__clear')).toBeNull();

    const input = q<HTMLInputElement>('.bsearch__input')!;
    input.value = 'lego';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted).toEqual(['lego']);
    expect(q('.bsearch__clear')).not.toBeNull();
    expect(q('.bsearch__clear')!.getAttribute('aria-label')).toBe('listings.browse.clearSearch');
  });

  it('the clear x empties the plain search and emits an empty query', () => {
    const { fixture, q, emitted } = setup({ query: 'lego' });
    fixture.detectChanges();
    expect(q('.bsearch__clear')).not.toBeNull();

    q('.bsearch__clear')!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['']);
    expect(q<HTMLInputElement>('.bsearch__input')!.value).toBe('');
    expect(q('.bsearch__clear')).toBeNull();
  });

  it('the Search button applies the plain text immediately (no debounce wait)', () => {
    const { fixture, q, emitted } = setup();
    const input = q<HTMLInputElement>('.bsearch__input')!;
    input.value = 'train';
    input.dispatchEvent(new Event('input'));
    emitted.length = 0;

    q('.bsearch__submit')!.click();
    fixture.detectChanges();

    expect(emitted).toEqual(['train']);
  });

  it('Smart search on: AI ring, sparkle icon, description field bound to the store, no q', () => {
    const { q } = setup({ ai: { mode: true, description: 'a balance bike' } });

    expect(q('.bsearch--ai')).not.toBeNull();
    expect(q('.bsearch__icon--ai')).not.toBeNull();
    expect(q('.aitg')!.getAttribute('aria-checked')).toBe('true');
    expect(q<HTMLInputElement>('.bsearch__input')!.value).toBe('a balance bike');
  });

  it('Smart search on, text typed: a hint line explains the Search button; empty field: no hint', () => {
    const typed = setup({ ai: { mode: true, description: 'a balance bike' } });
    expect(typed.q('[data-testid="ai-hint"]')!.textContent).toContain('listings.browse.aiHint');

    TestBed.resetTestingModule();
    const empty = setup({ ai: { mode: true, description: '' } });
    expect(empty.q('[data-testid="ai-hint"]')).toBeNull();
  });

  it('typing in AI mode updates the stored description, never the plain query', () => {
    const { fixture, q, dispatched, emitted } = setup({ ai: { mode: true } });

    const input = q<HTMLInputElement>('.bsearch__input')!;
    input.value = 'quiet toys';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(dispatched()).toContainEqual(ListingsActions.setAiDescription({ description: 'quiet toys' }));
    expect(emitted).toEqual([]);
  });

  it('Search in AI mode runs the AI search with the trimmed description', () => {
    const { q, dispatched } = setup({ ai: { mode: true, description: '  a balance bike ' } });

    q('.bsearch__submit')!.click();

    expect(dispatched()).toContainEqual(ListingsActions.submitAiSearch({ description: 'a balance bike' }));
  });

  it('a guest pressing Search in AI mode is sent to the sign-in dialog and nothing runs', () => {
    const { q, dispatched, auth } = setup({
      authenticated: false,
      ai: { mode: true, description: 'a balance bike' },
    });

    q('.bsearch__submit')!.click();

    expect(auth).toHaveLength(1);
    expect(dispatched().map((a) => a.type)).not.toContain(ListingsActions.submitAiSearch.type);
  });

  it('the clear x in AI mode empties the stored description', () => {
    const { q, dispatched } = setup({ ai: { mode: true, description: 'a balance bike' } });

    q('.bsearch__clear')!.click();

    expect(dispatched()).toContainEqual(ListingsActions.setAiDescription({ description: '' }));
  });

  it('daily budget spent: the switch is aria-disabled, explains itself, and does not turn AI on', () => {
    const { q, dispatched } = setup({ ai: { aiStatus: { available: false } } });

    const sw = q('.aitg')!;
    expect(sw.getAttribute('aria-disabled')).toBe('true');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('title')).toBe('listings.ai.budgetSpent');
    sw.click();
    expect(dispatched().map((a) => a.type)).not.toContain(ListingsActions.setAiMode.type);
  });
});
