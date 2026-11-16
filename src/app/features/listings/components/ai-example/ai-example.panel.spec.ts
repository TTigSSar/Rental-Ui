import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingsAi } from '../../store/listings.selectors';
import { initialListingsAiState, type ListingsAiState } from '../../store/listings.state';
import { AiExampleComponent } from './ai-example.component';

/** Browse Redesign Stage 1 example panel (`[panel]="true"`): 2 prompts + tags, click fills the field. */
function setup(ai: Partial<ListingsAiState>) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideMockStore({
        selectors: [
          { selector: selectIsAuthenticated, value: true },
          { selector: selectListingsAi, value: { ...initialListingsAiState, ...ai } },
        ],
      }),
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    listings: {
      browse: {
        examples: {
          title: 'Try an example. Click one to fill it in.',
          e1: { text: 'Balance bike for a 3-year-old', tag1: '3 yrs', tag2: '≤ 3,000 ֏', tag3: 'Kentron' },
          e2: { text: 'Quiet toys for a long flight', tag1: '2 yrs', tag2: 'Travel' },
        },
      },
    },
  });
  translate.use('en');
  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');
  const fixture = TestBed.createComponent(AiExampleComponent);
  fixture.componentRef.setInput('panel', true);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const dispatched = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as { type: string });
  return { fixture, el, dispatched };
}

describe('AiExampleComponent — Browse panel', () => {
  it('Smart search on with an empty field: a title and two prompts, each with its tags', () => {
    const { el } = setup({ mode: true, description: '' });

    expect(el.querySelector('.aiexp__head')!.textContent).toContain('Try an example. Click one to fill it in.');
    const cards = Array.from(el.querySelectorAll('.aiexp__card'));
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.aiexp__text')!.textContent).toContain('“Balance bike for a 3-year-old”');
    expect(Array.from(cards[0].querySelectorAll('.aiexp__tags span')).map((t) => t.textContent)).toEqual([
      '3 yrs',
      '≤ 3,000 ֏',
      'Kentron',
    ]);
    expect(Array.from(cards[1].querySelectorAll('.aiexp__tags span')).map((t) => t.textContent)).toEqual([
      '2 yrs',
      'Travel',
    ]);
  });

  it('is shown every time the field is empty - even after an example was used before', () => {
    const { el } = setup({ mode: true, description: '', exampleSeen: true });
    expect(el.querySelector('.aiexp')).not.toBeNull();
  });

  it('is hidden with Smart search off, and hidden once text is typed (the hint line takes over)', () => {
    expect(setup({ mode: false }).el.querySelector('.aiexp')).toBeNull();

    TestBed.resetTestingModule();
    expect(setup({ mode: true, description: 'bike' }).el.querySelector('.aiexp')).toBeNull();
  });

  it('clicking a prompt fills the field with its text and runs no search', () => {
    const { el, dispatched } = setup({ mode: true, description: '' });

    (el.querySelectorAll('.aiexp__card')[1] as HTMLButtonElement).click();

    expect(dispatched()).toEqual([
      ListingsActions.setAiDescription({ description: 'Quiet toys for a long flight' }),
      ListingsActions.markAiExampleSeen(),
    ]);
  });

  it('does not render the legacy first-use box or mobile line', () => {
    const { el } = setup({ mode: true, description: '' });
    expect(el.querySelector('.aiex__btn')).toBeNull();
    expect(el.querySelector('.aiex__line')).toBeNull();
  });
});
