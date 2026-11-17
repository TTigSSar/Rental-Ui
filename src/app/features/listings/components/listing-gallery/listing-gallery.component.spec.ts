import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { ListingGalleryComponent } from './listing-gallery.component';
import type { ListingImage } from '../../models/listing.model';

/** Access to the component's protected surface without loosening it for production code. */
interface GalleryAccess {
  readonly sortedImages: () => ListingImage[];
  readonly mainImage: () => ListingImage | null;
  readonly hasMultipleImages: () => boolean;
  readonly mosaicMain: () => ListingImage | null;
  readonly mosaicSatellites: () => ListingImage[];
  readonly totalCount: () => number;
  readonly activeIndex: () => number;
  readonly lightboxOpen: () => boolean;
  readonly lightboxIndex: () => number;
  selectIndex(index: number): void;
  goPrev(): void;
  goNext(): void;
  openLightbox(index: number): void;
  closeLightbox(): void;
  lightboxPrev(): void;
  lightboxNext(): void;
  lightboxHasPrev(): boolean;
  lightboxHasNext(): boolean;
  readonly dragOffset: () => number;
  onStagePointerDown(event: PointerEvent): void;
  onStagePointerMove(event: PointerEvent): void;
  onStagePointerUp(event: PointerEvent): void;
  onWindowKeydown(event: KeyboardEvent): void;
}

function image(id: string, sortOrder: number, isPrimary = false): ListingImage {
  return { id, url: `https://example.test/${id}.jpg`, isPrimary, sortOrder };
}

async function createFixture(
  images: ListingImage[],
): Promise<{ fixture: ComponentFixture<ListingGalleryComponent>; component: GalleryAccess }> {
  await TestBed.configureTestingModule({
    imports: [ListingGalleryComponent, TranslateModule.forRoot()],
  }).compileComponents();

  const fixture = TestBed.createComponent(ListingGalleryComponent);
  fixture.componentRef.setInput('images', images);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance as unknown as GalleryAccess };
}

describe('ListingGalleryComponent', () => {
  it('sorts images by sortOrder regardless of input order', async () => {
    const { component } = await createFixture([image('c', 2), image('a', 0), image('b', 1)]);
    expect(component.sortedImages().map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('renders the empty state with zero images', async () => {
    const { component } = await createFixture([]);
    expect(component.totalCount()).toBe(0);
    expect(component.mainImage()).toBeNull();
    expect(component.mosaicMain()).toBeNull();
    expect(component.mosaicSatellites()).toEqual([]);
  });

  it('has no satellites and is not "multiple" with a single image', async () => {
    const { component } = await createFixture([image('a', 0)]);
    expect(component.totalCount()).toBe(1);
    expect(component.hasMultipleImages()).toBe(false);
    expect(component.mosaicMain()?.id).toBe('a');
    expect(component.mosaicSatellites()).toEqual([]);
  });

  it('caps the mosaic to 1 main + 4 satellites even with more photos', async () => {
    const images = Array.from({ length: 8 }, (_, i) => image(`img${i}`, i));
    const { component } = await createFixture(images);
    expect(component.totalCount()).toBe(8);
    expect(component.mosaicMain()?.id).toBe('img0');
    expect(component.mosaicSatellites().map((i) => i.id)).toEqual(['img1', 'img2', 'img3', 'img4']);
  });

  it('wraps forward and backward through the mobile hero via selectIndex/goNext/goPrev', async () => {
    const { component } = await createFixture([image('a', 0), image('b', 1), image('c', 2)]);
    expect(component.activeIndex()).toBe(0);

    component.goPrev();
    expect(component.activeIndex()).toBe(2); // wraps to the last image

    component.goNext();
    expect(component.activeIndex()).toBe(0); // wraps back to the first

    component.selectIndex(5); // out-of-range index wraps via modulo
    expect(component.activeIndex()).toBe(2);
  });

  it('does nothing when selecting an index with no images', async () => {
    const { component } = await createFixture([]);
    component.selectIndex(0);
    expect(component.activeIndex()).toBe(0);
  });

  describe('lightbox', () => {
    it('opens at the requested index and closes', async () => {
      const { component } = await createFixture([image('a', 0), image('b', 1)]);
      expect(component.lightboxOpen()).toBe(false);

      component.openLightbox(1);
      expect(component.lightboxOpen()).toBe(true);
      expect(component.lightboxIndex()).toBe(1);

      component.closeLightbox();
      expect(component.lightboxOpen()).toBe(false);
    });

    it('navigates prev/next without wrapping, independently of the mobile hero index', async () => {
      const { component } = await createFixture([image('a', 0), image('b', 1), image('c', 2)]);
      component.openLightbox(0);

      component.lightboxPrev();
      expect(component.lightboxIndex()).toBe(0); // stops at the first photo
      expect(component.lightboxHasPrev()).toBe(false);
      expect(component.lightboxHasNext()).toBe(true);

      component.lightboxNext();
      component.lightboxNext();
      expect(component.lightboxIndex()).toBe(2);
      component.lightboxNext();
      expect(component.lightboxIndex()).toBe(2); // stops at the last photo
      expect(component.lightboxHasNext()).toBe(false);

      // The mobile hero's own index is untouched by lightbox navigation.
      expect(component.activeIndex()).toBe(0);
    });

    it('hides prev at the first photo and next at the last photo', async () => {
      const { fixture, component } = await createFixture([image('a', 0), image('b', 1)]);
      component.openLightbox(0);
      fixture.detectChanges();
      const q = (sel: string) => document.body.querySelector(sel);
      expect(q('.listing-gallery__lightbox-nav--prev')).toBeNull();
      expect(q('.listing-gallery__lightbox-nav--next')).not.toBeNull();

      component.lightboxNext();
      fixture.detectChanges();
      expect(q('.listing-gallery__lightbox-nav--prev')).not.toBeNull();
      expect(q('.listing-gallery__lightbox-nav--next')).toBeNull();
    });

    it('keyboard arrows stop at both ends', async () => {
      const { component } = await createFixture([image('a', 0), image('b', 1)]);
      component.openLightbox(0);
      component.onWindowKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      expect(component.lightboxIndex()).toBe(0);
      component.onWindowKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      component.onWindowKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(component.lightboxIndex()).toBe(1);
    });

    describe('touch gestures', () => {
      const ptr = (x: number, y: number, t: number): PointerEvent =>
        ({
          pointerId: 1,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
          timeStamp: t,
        }) as PointerEvent;

      async function open(images: ListingImage[], index = 1) {
        const ctx = await createFixture(images);
        ctx.component.openLightbox(index);
        return ctx.component;
      }

      it('a horizontal swipe changes photo (left = next, right = prev)', async () => {
        const c = await open([image('a', 0), image('b', 1), image('c', 2)]);
        c.onStagePointerDown(ptr(200, 300, 0));
        c.onStagePointerMove(ptr(120, 303, 100));
        c.onStagePointerUp(ptr(100, 304, 300));
        expect(c.lightboxIndex()).toBe(2);

        c.onStagePointerDown(ptr(100, 300, 1000));
        c.onStagePointerMove(ptr(180, 302, 1100));
        c.onStagePointerUp(ptr(200, 302, 1300));
        expect(c.lightboxIndex()).toBe(1);
      });

      it('a horizontal swipe respects the no-wrap ends', async () => {
        const c = await open([image('a', 0), image('b', 1)], 0);
        c.onStagePointerDown(ptr(100, 300, 0));
        c.onStagePointerMove(ptr(180, 300, 100));
        c.onStagePointerUp(ptr(220, 300, 400));
        expect(c.lightboxIndex()).toBe(0);
      });

      it('a tiny slow horizontal move does not change photo', async () => {
        const c = await open([image('a', 0), image('b', 1), image('c', 2)]);
        c.onStagePointerDown(ptr(200, 300, 0));
        c.onStagePointerMove(ptr(180, 300, 200));
        c.onStagePointerUp(ptr(170, 300, 1000));
        expect(c.lightboxIndex()).toBe(1);
      });

      it('swiping down past the threshold closes the viewer', async () => {
        const c = await open([image('a', 0), image('b', 1)]);
        c.onStagePointerDown(ptr(200, 100, 0));
        c.onStagePointerMove(ptr(202, 160, 400));
        expect(c.dragOffset()).toBe(60);
        c.onStagePointerUp(ptr(202, 260, 900));
        expect(c.lightboxOpen()).toBe(false);
      });

      it('a short, slow swipe down snaps back and stays open', async () => {
        const c = await open([image('a', 0), image('b', 1)]);
        c.onStagePointerDown(ptr(200, 100, 0));
        c.onStagePointerMove(ptr(200, 140, 800));
        c.onStagePointerUp(ptr(200, 150, 1500));
        expect(c.lightboxOpen()).toBe(true);
        expect(c.dragOffset()).toBe(0);
      });

      it('ignores mouse pointers', async () => {
        const c = await open([image('a', 0), image('b', 1)]);
        const mouse = { ...ptr(200, 100, 0), pointerType: 'mouse' } as PointerEvent;
        c.onStagePointerDown(mouse);
        c.onStagePointerMove(ptr(200, 300, 100));
        expect(c.dragOffset()).toBe(0);
      });
    });

    it('single photo renders no counter, thumbnails or arrows', async () => {
      const { fixture, component } = await createFixture([image('a', 0)]);
      component.openLightbox(0);
      fixture.detectChanges();
      const q = (sel: string) => document.body.querySelector(sel);
      expect(q('.listing-gallery__lightbox-close')).not.toBeNull();
      expect(q('.listing-gallery__lightbox-counter')).toBeNull();
      expect(q('.listing-gallery__lightbox-thumbs')).toBeNull();
      expect(q('.listing-gallery__lightbox-nav')).toBeNull();
    });

    it('responds to arrow keys only while open', async () => {
      const { component } = await createFixture([image('a', 0), image('b', 1)]);

      const rightArrow = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      component.onWindowKeydown(rightArrow);
      expect(component.lightboxIndex()).toBe(0); // closed — ignored

      component.openLightbox(0);
      component.onWindowKeydown(rightArrow);
      expect(component.lightboxIndex()).toBe(1);

      const leftArrow = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      component.onWindowKeydown(leftArrow);
      expect(component.lightboxIndex()).toBe(0);
    });

    it('resets lightbox and hero state when the images input changes', async () => {
      const { fixture, component } = await createFixture([image('a', 0), image('b', 1)]);
      component.selectIndex(1);
      component.openLightbox(1);
      expect(component.lightboxOpen()).toBe(true);

      fixture.componentRef.setInput('images', [image('x', 0)]);
      fixture.detectChanges();

      expect(component.activeIndex()).toBe(0);
      expect(component.lightboxOpen()).toBe(false);
      expect(component.lightboxIndex()).toBe(0);
    });
  });
});
