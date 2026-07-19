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

  it('exposes exactly one accessible name — the button aria-label', () => {
    const host: HTMLElement = createFixture().nativeElement;

    expect(host.querySelector('.category-tile')!.getAttribute('aria-label')).toBe(
      'Outdoor Toys',
    );

    // Both visible labels are decorative: the overlay (desktop) and the chip
    // (mobile). Without this, a screen reader would announce the name twice.
    expect(
      host.querySelector('.category-tile__overlay-label')!.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(host.querySelector('.category-tile__chip')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('keeps the chip in the DOM so the mobile (≤560px) label survives', () => {
    // Desktop hides the chip with `display: none` in CSS, not with @if — the
    // media query alone decides which of the two labels is visible.
    const host: HTMLElement = createFixture().nativeElement;
    const chip = host.querySelector('.category-tile__chip');

    expect(chip).not.toBeNull();
    expect(chip!.textContent?.trim()).toBe('Outdoor Toys');
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
