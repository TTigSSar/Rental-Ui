import { TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import type { ListingCategoryOption } from '../../models/create-listing.model';
import { AiNoResultsComponent } from './ai-no-results.component';

const CATEGORIES = [
  { id: 'c1', name: 'Bikes' },
  { id: 'c2', name: 'Puzzles' },
] as ListingCategoryOption[];

function setup(hasDistrictFilter: boolean, categories: readonly ListingCategoryOption[] = CATEGORIES) {
  TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()] });
  const fixture = TestBed.createComponent(AiNoResultsComponent);
  fixture.componentRef.setInput('hasDistrictFilter', hasDistrictFilter);
  fixture.componentRef.setInput('categories', categories);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const events: string[] = [];
  const c = fixture.componentInstance;
  c.widen.subscribe(() => events.push('widen'));
  c.increaseBudget.subscribe(() => events.push('budget'));
  c.editDescription.subscribe(() => events.push('edit'));
  c.categorySelected.subscribe((id) => events.push(`category:${id}`));
  const texts = (sel: string) => Array.from(el.querySelectorAll(sel)).map((n) => n.textContent!.trim());
  return { el, events, texts };
}

describe('AiNoResultsComponent', () => {
  it('has a labelled title and the search icon; no bell, no "Clear filters"', () => {
    const { el } = setup(true);

    const section = el.querySelector('section')!;
    const title = el.querySelector('h3')!;
    expect(section.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.textContent).toContain('listings.ai.emptyTitle');
    expect(el.querySelector('.pi-search')).not.toBeNull();
    expect(el.querySelector('.pi-bell')).toBeNull();
    expect(el.textContent).not.toMatch(/clear/i);
  });

  it('with districts: primary "Widen the area", then "Increase the budget" and "Edit description"', () => {
    const { el, texts, events } = setup(true);

    expect(texts('.ai-empty__primary')).toEqual(['listings.ai.widen']);
    expect(texts('.ai-empty__outline')).toEqual(['listings.ai.budget', 'listings.ai.edit']);

    el.querySelector<HTMLButtonElement>('.ai-empty__primary')!.click();
    const outline = el.querySelectorAll<HTMLButtonElement>('.ai-empty__outline');
    outline[0].click();
    outline[1].click();
    expect(events).toEqual(['widen', 'budget', 'edit']);
  });

  it('without districts: the primary is "Edit description" and only the budget button follows', () => {
    const { el, texts, events } = setup(false);

    expect(texts('.ai-empty__primary')).toEqual(['listings.ai.edit']);
    expect(texts('.ai-empty__outline')).toEqual(['listings.ai.budget']);
    expect(el.textContent).not.toContain('listings.ai.widen');

    el.querySelector<HTMLButtonElement>('.ai-empty__primary')!.click();
    expect(events).toEqual(['edit']);
  });

  it('category pills are labelled by "Or browse other categories" and emit the chosen id', () => {
    const { el, texts, events } = setup(true);

    const group = el.querySelector('.ai-empty__pills')!;
    expect(el.querySelector(`#${group.getAttribute('aria-labelledby')}`)!.textContent).toContain('listings.ai.browse');
    expect(texts('.ai-empty__pill')).toEqual(['Bikes', 'Puzzles']);

    el.querySelectorAll<HTMLButtonElement>('.ai-empty__pill')[1].click();
    expect(events).toEqual(['category:c2']);
  });

  it('renders no browse block when there are no categories', () => {
    const { el } = setup(true, []);
    expect(el.querySelector('.ai-empty__browse')).toBeNull();
  });
});
