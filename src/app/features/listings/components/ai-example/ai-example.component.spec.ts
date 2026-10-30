import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { selectIsAuthenticated } from '../../../auth/store/auth.selectors';
import * as ListingsActions from '../../store/listings.actions';
import { selectListingsAi } from '../../store/listings.selectors';
import { initialListingsAiState } from '../../store/listings.state';
import { AiExampleComponent } from './ai-example.component';

@Component({
  imports: [AiExampleComponent],
  template: `<app-ai-example [withHint]="withHint" (authRequired)="auth = auth + 1" />`,
})
class HostComponent {
  withHint = true;
  auth = 0;
}

const EXAMPLE = 'a bike for a 3-year-old, up to 3,000 AMD a day';

function setup(options: { withHint: boolean; authenticated: boolean }) {
  TestBed.configureTestingModule({
    imports: [TranslateModule.forRoot()],
    providers: [
      provideMockStore({
        selectors: [
          { selector: selectIsAuthenticated, value: options.authenticated },
          {
            selector: selectListingsAi,
            value: { ...initialListingsAiState, mode: true },
          },
        ],
      }),
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('en', {
    listings: {
      ai: {
        hintPrefix: 'Describe what you’re looking for. For example:',
        hintExample: EXAMPLE,
        example: 'The long example',
        exampleLabel: 'Example · tap to use',
        exampleShort: 'Short',
      },
    },
  });
  translate.use('en');
  const store = TestBed.inject(MockStore);
  vi.spyOn(store, 'dispatch');
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.withHint = options.withHint;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const dispatched = () =>
    (store.dispatch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as { type: string });
  return { fixture, el, dispatched };
}

describe('AiExampleComponent', () => {
  it('mobile: one line with the prefix as text and the example as a link button', () => {
    const { el } = setup({ withHint: true, authenticated: true });
    const line = el.querySelector('.aiex__line')!;
    expect(line.textContent).toContain('Describe what you’re looking for. For example:');
    const link = line.querySelector('button.aiex__link')!;
    expect(link.textContent?.trim()).toBe(EXAMPLE);
    expect(el.querySelector('.aiex__btn')).toBeNull();
  });

  it('mobile tap: sets the shown example, marks it seen and runs the search', () => {
    const { el, dispatched } = setup({ withHint: true, authenticated: true });
    (el.querySelector('.aiex__link') as HTMLButtonElement).click();
    expect(dispatched()).toEqual([
      ListingsActions.setAiDescription({ description: EXAMPLE }),
      ListingsActions.markAiExampleSeen(),
      ListingsActions.submitAiSearch({ description: EXAMPLE }),
    ]);
  });

  it('mobile tap as a guest: fills the field and asks the host for sign-in, no search', () => {
    const { fixture, el, dispatched } = setup({ withHint: true, authenticated: false });
    (el.querySelector('.aiex__link') as HTMLButtonElement).click();
    expect(fixture.componentInstance.auth).toBe(1);
    expect(dispatched()).toEqual([
      ListingsActions.setAiDescription({ description: EXAMPLE }),
      ListingsActions.markAiExampleSeen(),
    ]);
  });

  it('desktop box is unchanged: fills the full example, no search', () => {
    const { el, dispatched } = setup({ withHint: false, authenticated: true });
    (el.querySelector('.aiex__btn') as HTMLButtonElement).click();
    expect(dispatched()).toEqual([
      ListingsActions.setAiDescription({ description: 'The long example' }),
      ListingsActions.markAiExampleSeen(),
    ]);
  });
});
