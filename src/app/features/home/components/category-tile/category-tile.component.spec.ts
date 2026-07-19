import { TestBed } from '@angular/core/testing';

import {
  CategoryTileComponent,
  type HomeCategoryTileVm,
} from './category-tile.component';

const CATEGORY: HomeCategoryTileVm = {
  id: 'cat-1',
  slug: 'outdoor',
  label: 'Outdoor Toys',
  imageUrl: null,
  iconName: null,
  icon: 'pi pi-sun',
  tintA: '#3fd69b',
  tintB: '#12a97c',
};

function createFixture(category: HomeCategoryTileVm = CATEGORY) {
  TestBed.configureTestingModule({ imports: [CategoryTileComponent] });

  const fixture = TestBed.createComponent(CategoryTileComponent);
  fixture.componentRef.setInput('category', category);
  fixture.detectChanges();

  return fixture;
}

describe('CategoryTileComponent overlay label', () => {
  it('renders the category name over the media', () => {
    const host: HTMLElement = createFixture().nativeElement;
    const overlay = host.querySelector('.category-tile__overlay-label');

    expect(overlay).not.toBeNull();
    expect(overlay!.textContent?.trim()).toBe('Outdoor Toys');
  });

  it('keeps the overlay out of the a11y tree so the name is announced once', () => {
    const host: HTMLElement = createFixture().nativeElement;

    // The chip below the tile plus the button's aria-label already expose the
    // name; the overlay is a duplicate and must stay decorative.
    expect(
      host.querySelector('.category-tile__overlay-label')!.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(host.querySelector('.category-tile')!.getAttribute('aria-label')).toBe(
      'Outdoor Toys',
    );
    expect(host.querySelector('.category-tile__chip')!.textContent?.trim()).toBe(
      'Outdoor Toys',
    );
  });

  it('still renders the overlay when the category has a real image', () => {
    const host: HTMLElement = createFixture({
      ...CATEGORY,
      imageUrl: '/uploads/outdoor.jpg',
    }).nativeElement;

    expect(host.querySelector('.category-tile__image')).not.toBeNull();
    expect(host.querySelector('.category-tile__overlay-label')).not.toBeNull();
  });
});
