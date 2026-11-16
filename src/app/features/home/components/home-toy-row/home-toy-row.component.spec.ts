import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { makeListingPreview } from '../../../../../testing/fixtures';
import type { ListingPreview } from '../../../listings/models/listing.model';
import { HomeToyRowComponent } from './home-toy-row.component';

function createRow(
  inputs: { items?: ListingPreview[]; loading?: boolean; ownIds?: Set<string> } = {},
) {
  TestBed.configureTestingModule({
    imports: [HomeToyRowComponent, TranslateModule.forRoot()],
    providers: [provideRouter([]), provideMockStore({ initialState: {} })],
  });
  const fixture = TestBed.createComponent(HomeToyRowComponent);
  fixture.componentRef.setInput('items', inputs.items ?? []);
  fixture.componentRef.setInput('loading', inputs.loading ?? false);
  fixture.componentRef.setInput('ownIds', inputs.ownIds ?? new Set<string>());
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  return { fixture, el };
}

function setTrack(
  fixture: ReturnType<typeof createRow>['fixture'],
  metrics: { scrollLeft: number; clientWidth: number; scrollWidth: number },
): HTMLElement {
  const track = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.row__track')!;
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(track, key, { configurable: true, value });
  }
  track.dispatchEvent(new Event('scroll'));
  fixture.detectChanges();
  return track;
}

const ITEMS = [1, 2, 3, 4, 5, 6].map((n) =>
  makeListingPreview({ id: `toy-${n}`, title: `Toy ${n}` }),
);

describe('HomeToyRowComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders one card per item', () => {
    const { el } = createRow({ items: ITEMS });

    expect(el.querySelectorAll('app-home-toy-card').length).toBe(6);
    expect(el.querySelector('app-home-toy-card-skeleton')).toBeNull();
  });

  it('exposes the scroller as a list of listitems', () => {
    const { el } = createRow({ items: ITEMS });

    expect(el.querySelector('.row__track')!.getAttribute('role')).toBe('list');
    const cards = Array.from(el.querySelectorAll('app-home-toy-card'));
    expect(cards.every((c) => c.getAttribute('role') === 'listitem')).toBe(true);
  });

  it('renders card-shaped skeletons, and no arrows, while loading', () => {
    const { el } = createRow({ loading: true });

    expect(el.querySelectorAll('app-home-toy-card-skeleton').length).toBe(5);
    expect(el.querySelector('app-home-toy-card')).toBeNull();
    expect(el.querySelector('.row__arrow')).toBeNull();
  });

  it('hides the favourite button on the viewer’s own listing only', () => {
    const { el } = createRow({ items: ITEMS.slice(0, 2), ownIds: new Set(['toy-1']) });
    const cards = Array.from(el.querySelectorAll('app-home-toy-card'));

    expect(cards[0].querySelector('.tcard__fav')).toBeNull();
    expect(cards[1].querySelector('.tcard__fav')).not.toBeNull();
  });

  it('re-emits a card’s favourite toggle', () => {
    const { fixture, el } = createRow({ items: ITEMS.slice(0, 1) });
    const emitted: string[] = [];
    fixture.componentInstance.favoriteToggled.subscribe((id) => emitted.push(id));

    el.querySelector<HTMLButtonElement>('.tcard__fav')!.click();

    expect(emitted).toEqual(['toy-1']);
  });

  describe('arrows', () => {
    function arrows(el: HTMLElement) {
      return {
        prev: el.querySelector<HTMLButtonElement>('.row__arrow--prev')!,
        next: el.querySelector<HTMLButtonElement>('.row__arrow--next')!,
      };
    }

    it('keeps both arrows in the DOM and marks the unusable one aria-disabled', () => {
      const { fixture, el } = createRow({ items: ITEMS });

      setTrack(fixture, { scrollLeft: 0, clientWidth: 1440, scrollWidth: 2100 });
      expect(arrows(el).prev.getAttribute('aria-disabled')).toBe('true');
      expect(arrows(el).next.hasAttribute('aria-disabled')).toBe(false);

      setTrack(fixture, { scrollLeft: 400, clientWidth: 1440, scrollWidth: 2100 });
      expect(arrows(el).prev.hasAttribute('aria-disabled')).toBe(false);
      expect(arrows(el).next.hasAttribute('aria-disabled')).toBe(false);

      setTrack(fixture, { scrollLeft: 660, clientWidth: 1440, scrollWidth: 2100 });
      expect(arrows(el).prev.hasAttribute('aria-disabled')).toBe(false);
      expect(arrows(el).next.getAttribute('aria-disabled')).toBe('true');
    });

    it('does not scroll when the pressed arrow is disabled', () => {
      const { fixture, el } = createRow({ items: ITEMS });
      const track = setTrack(fixture, { scrollLeft: 0, clientWidth: 1440, scrollWidth: 2100 });
      const scrollBy = vi.fn();
      track.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];

      arrows(el).prev.click();

      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('scrolls by one page of whole cards', () => {
      const { fixture, el } = createRow({ items: ITEMS });
      const track = setTrack(fixture, { scrollLeft: 0, clientWidth: 1440, scrollWidth: 2100 });
      const scrollBy = vi.fn();
      track.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
      // 313px cards, 16px gap, 70px gutters: four whole cards fit between them.
      (track.firstElementChild as HTMLElement).getBoundingClientRect = () =>
        ({ width: 313 }) as DOMRect;
      const styles = { columnGap: '16px', paddingLeft: '70px' } as CSSStyleDeclaration;
      vi.spyOn(window, 'getComputedStyle').mockReturnValue(styles);

      arrows(el).next.click();

      expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 4 * (313 + 16) }));
    });
  });
});
