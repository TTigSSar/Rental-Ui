import { TestBed } from '@angular/core/testing';

import {
  CategoryTileComponent,
  type HomeCategoryTileVm,
} from './category-tile.component';
import { DEFAULT_CATEGORY_COLOR } from '../../../../shared/utils/category-palette.model';

const CATEGORY: HomeCategoryTileVm = {
  id: 'cat-1',
  slug: 'outdoor',
  label: 'Outdoor Toys',
  iconName: 'sparkle',
  colorHex: '#3fd69b',
};

function createFixture(category: HomeCategoryTileVm = CATEGORY) {
  // Reset first: a couple of specs below create more than one fixture per
  // `it` (to diff two rendered backgrounds against each other), and TestBed
  // refuses a second `configureTestingModule` once it has instantiated.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [CategoryTileComponent] });

  const fixture = TestBed.createComponent(CategoryTileComponent);
  fixture.componentRef.setInput('category', category);
  fixture.detectChanges();

  return fixture;
}

describe('CategoryTileComponent accessible name', () => {
  it('is a single real button named by the category label', () => {
    const host: HTMLElement = createFixture().nativeElement;
    const buttons = host.querySelectorAll('button');

    expect(buttons.length).toBe(1);
    expect(buttons[0].type).toBe('button');
    // The name comes from the visible text, not a duplicated aria-label.
    expect(buttons[0].hasAttribute('aria-label')).toBe(false);
    expect(host.querySelector('.category-tile__label')!.textContent?.trim()).toBe(
      'Outdoor Toys',
    );
  });

  it('hides the icon from assistive tech so the name is read once', () => {
    const host: HTMLElement = createFixture().nativeElement;

    expect(host.querySelector('.category-tile__icon-wrap')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(host.querySelector('app-icon svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets neither a title tooltip nor a per-label lang', () => {
    const host: HTMLElement = createFixture().nativeElement;
    const button = host.querySelector('button')!;

    expect(button.hasAttribute('title')).toBe(false);
    expect(button.hasAttribute('lang')).toBe(false);
  });

  it('emits the category on click', () => {
    const fixture = createFixture();
    const selected: HomeCategoryTileVm[] = [];
    fixture.componentInstance.select.subscribe((c) => selected.push(c));

    fixture.nativeElement.querySelector('button').click();

    expect(selected).toEqual([CATEGORY]);
  });
});

describe('CategoryTileComponent icon + colour', () => {
  it('renders the admin-picked icon via the shared icon component', () => {
    const host: HTMLElement = createFixture({
      ...CATEGORY,
      iconName: 'truck',
    }).nativeElement;

    // The shared icon component renders an <svg>, not a PrimeIcon <i> glyph.
    expect(host.querySelector('.category-tile__icon svg')).not.toBeNull();
    expect(host.querySelector('.category-tile__icon i')).toBeNull();
  });

  function tileBackground(category: HomeCategoryTileVm): string {
    const host: HTMLElement = createFixture(category).nativeElement;
    return host.querySelector<HTMLElement>('.category-tile')!.style.background;
  }

  it('honours the admin-picked colour as the tile background', () => {
    const blue = tileBackground({ ...CATEGORY, colorHex: '#D9E8FF' });
    const peach = tileBackground({ ...CATEGORY, colorHex: '#FFE6CC' });

    expect(blue.length).toBeGreaterThan(0);
    expect(blue).not.toBe(peach);
  });

  it('falls back to the default palette colour for a malformed colorHex', () => {
    const malformed = tileBackground({ ...CATEGORY, colorHex: 'not-a-color' });
    const fallback = tileBackground({ ...CATEGORY, colorHex: DEFAULT_CATEGORY_COLOR });

    expect(malformed).toBe(fallback);
  });

  it('falls back to the default palette colour for an empty colorHex', () => {
    const empty = tileBackground({ ...CATEGORY, colorHex: '' });
    const fallback = tileBackground({ ...CATEGORY, colorHex: DEFAULT_CATEGORY_COLOR });

    expect(empty).toBe(fallback);
  });

  it('accepts an 8-digit hex colour', () => {
    const eightDigit = tileBackground({ ...CATEGORY, colorHex: '#D9E8FFCC' });
    const fallback = tileBackground({ ...CATEGORY, colorHex: DEFAULT_CATEGORY_COLOR });

    expect(eightDigit).not.toBe(fallback);
  });
});
