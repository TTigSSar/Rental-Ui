import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

import { makeAdminCategory } from '../../../../../testing/fixtures';
import * as AdminCategoriesActions from '../../store/admin-categories.actions';
import { adminCategoriesFeatureKey } from '../../store/admin-categories.reducer';
import { initialAdminCategoriesState } from '../../store/admin-categories.state';
import { CategoriesPageComponent } from './categories-page.component';

function mockMatchMedia(matchesDesktop: boolean): void {
  (window as unknown as { matchMedia: typeof matchMedia }).matchMedia = ((query: string) => ({
    matches: query === '(min-width: 961px)' ? matchesDesktop : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof matchMedia;
}

describe('CategoriesPageComponent', () => {
  let fixture: ComponentFixture<CategoriesPageComponent>;
  let store: MockStore;

  async function configure(
    overrides: Partial<typeof initialAdminCategoriesState> = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CategoriesPageComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore({
          initialState: {
            [adminCategoriesFeatureKey]: { ...initialAdminCategoriesState, ...overrides },
          },
        }),
      ],
    }).compileComponents();
    store = TestBed.inject(MockStore);
  }

  async function setup(
    overrides: Partial<typeof initialAdminCategoriesState> = {},
    desktop = true,
  ): Promise<void> {
    mockMatchMedia(desktop);
    await configure(overrides);
    fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
  }

  it('dispatches loadCategories on init', async () => {
    mockMatchMedia(true);
    await configure();
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    fixture = TestBed.createComponent(CategoriesPageComponent);
    fixture.detectChanges();
    expect(dispatchSpy).toHaveBeenCalledWith(AdminCategoriesActions.loadCategories());
  });

  it('shows the table-shaped skeleton while loading with no items yet (desktop)', async () => {
    await setup({ isLoading: true, items: [] });
    expect(
      fixture.nativeElement.querySelectorAll('.categories-page__skeleton-row').length,
    ).toBeGreaterThan(0);
  });

  it('shows the card-shaped skeleton while loading with no items yet (mobile)', async () => {
    await setup({ isLoading: true, items: [] }, false);
    expect(
      fixture.nativeElement.querySelectorAll('.categories-page__skeleton-card').length,
    ).toBeGreaterThan(0);
  });

  it('shows the empty state once loaded with no categories', async () => {
    await setup({ isLoading: false, items: [] });
    expect(fixture.nativeElement.querySelector('app-ui-empty-state')).not.toBeNull();
  });

  it('renders one table row per category on desktop', async () => {
    await setup({
      isLoading: false,
      items: [makeAdminCategory({ id: 'c1' }), makeAdminCategory({ id: 'c2' })],
    });
    expect(fixture.nativeElement.querySelectorAll('.categories-page__row').length).toBe(2);
  });

  it('renders one card per category on mobile', async () => {
    await setup(
      {
        isLoading: false,
        items: [makeAdminCategory({ id: 'c1' }), makeAdminCategory({ id: 'c2' })],
      },
      false,
    );
    expect(fixture.nativeElement.querySelectorAll('.categories-page__card').length).toBe(2);
  });

  describe('reorder (always sends the full ordered id list)', () => {
    it('moveUp swaps with the previous item and dispatches every id in the new order', async () => {
      await setup({
        isLoading: false,
        items: [
          makeAdminCategory({ id: 'c1' }),
          makeAdminCategory({ id: 'c2' }),
          makeAdminCategory({ id: 'c3' }),
        ],
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['moveUp'](1);
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminCategoriesActions.reorderCategories({ orderedIds: ['c2', 'c1', 'c3'] }),
      );
    });

    it('moveDown swaps with the next item and dispatches every id in the new order', async () => {
      await setup({
        isLoading: false,
        items: [
          makeAdminCategory({ id: 'c1' }),
          makeAdminCategory({ id: 'c2' }),
          makeAdminCategory({ id: 'c3' }),
        ],
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['moveDown'](0);
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminCategoriesActions.reorderCategories({ orderedIds: ['c2', 'c1', 'c3'] }),
      );
    });

    it('does nothing at the ends (out-of-range target index)', async () => {
      await setup({
        isLoading: false,
        items: [makeAdminCategory({ id: 'c1' }), makeAdminCategory({ id: 'c2' })],
      });
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['moveUp'](0);
      fixture.componentInstance['moveDown'](1);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });
  });

  it('toggles visibility with the flipped value', async () => {
    await setup({
      isLoading: false,
      items: [makeAdminCategory({ id: 'c1', isVisible: true })],
    });
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    fixture.componentInstance['toggleVisibility'](makeAdminCategory({ id: 'c1', isVisible: true }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      AdminCategoriesActions.updateVisibility({ id: 'c1', isVisible: false }),
    );
  });

  describe('delete flow', () => {
    it('dispatches deleteCategory with no reassign target for an empty category', async () => {
      await setup({ isLoading: false, items: [] });
      fixture.componentInstance['startDelete'](makeAdminCategory({ id: 'c1', listingCount: 0 }));
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['confirmDeleteSimple']();
      expect(dispatchSpy).toHaveBeenCalledWith(AdminCategoriesActions.deleteCategory({ id: 'c1' }));
    });

    it('dispatches deleteCategory with the chosen reassign target', async () => {
      await setup({ isLoading: false, items: [] });
      fixture.componentInstance['startDelete'](makeAdminCategory({ id: 'c1', listingCount: 5 }));
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['confirmDeleteExisting']('c2');
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminCategoriesActions.deleteCategory({ id: 'c1', reassignToCategoryId: 'c2' }),
      );
    });

    it('dispatches deleteCategoryToNewCategory for the "+ new category" reassign path', async () => {
      await setup({ isLoading: false, items: [] });
      fixture.componentInstance['startDelete'](makeAdminCategory({ id: 'c1', listingCount: 5 }));
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['confirmDeleteNew']({ name: 'Brand New', nameHy: 'Նոր', nameRu: 'Новая' });
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminCategoriesActions.deleteCategoryToNewCategory({
          id: 'c1',
          newCategory: expect.objectContaining({ name: 'Brand New', nameHy: 'Նոր', nameRu: 'Новая' }),
        }),
      );
    });

    it('excludes the category being deleted from the reassign target list', async () => {
      await setup({
        isLoading: false,
        items: [makeAdminCategory({ id: 'c1' }), makeAdminCategory({ id: 'c2' })],
      });
      fixture.componentInstance['startDelete'](makeAdminCategory({ id: 'c1', listingCount: 3 }));
      expect(fixture.componentInstance['deleteOtherCategories']().map((c) => c.id)).toEqual(['c2']);
    });
  });

  it('renders the create panel with an app-category-form-panel when toggled open', async () => {
    await setup({ isLoading: false, items: [] });
    fixture.componentInstance['toggleCreate']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.categories-page__create-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-category-form-panel')).not.toBeNull();
  });

  it('dispatches createCategory with the entered name/icon/color on submit', async () => {
    await setup({ isLoading: false, items: [] });
    fixture.componentInstance['toggleCreate']();
    fixture.componentInstance['newName'].set('Outdoor');
    fixture.componentInstance['newNameHy'].set('Դրսի խաղեր');
    fixture.componentInstance['newNameRu'].set('Игры на улице');
    fixture.componentInstance['newIcon'].set('glob');
    fixture.componentInstance['newColor'].set('#D9F0EC');
    const dispatchSpy = vi.spyOn(store, 'dispatch');
    fixture.componentInstance['submitCreate']();
    expect(dispatchSpy).toHaveBeenCalledWith(
      AdminCategoriesActions.createCategory({
        tempId: expect.any(String),
        request: {
          name: 'Outdoor',
          nameHy: 'Դրսի խաղեր',
          nameRu: 'Игры на улице',
          iconName: 'glob',
          colorHex: '#D9F0EC',
        },
      }),
    );
  });

  describe('required name fields (ADR-062)', () => {
    it('does not dispatch create and shows an error per blank hy/ru field', async () => {
      await setup({ isLoading: false, items: [] });
      fixture.componentInstance['toggleCreate']();
      fixture.componentInstance['newName'].set('Outdoor');
      fixture.detectChanges();
      const dispatchSpy = vi.spyOn(store, 'dispatch');

      fixture.componentInstance['submitCreate']();
      fixture.detectChanges();

      expect(dispatchSpy).not.toHaveBeenCalled();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('#category-form-panel-name-en-required')).toBeNull();
      expect(el.querySelector('#category-form-panel-name-hy-required')).not.toBeNull();
      expect(el.querySelector('#category-form-panel-name-ru-required')).not.toBeNull();
    });

    it('does not dispatch create when only whitespace is entered in ru', async () => {
      await setup({ isLoading: false, items: [] });
      fixture.componentInstance['toggleCreate']();
      fixture.componentInstance['newName'].set('Outdoor');
      fixture.componentInstance['newNameHy'].set('Դրսի խաղեր');
      fixture.componentInstance['newNameRu'].set('   ');
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['submitCreate']();
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('does not dispatch update when a name is blank', async () => {
      const category = makeAdminCategory({ id: 'c1', name: 'A', nameHy: 'Ա', nameRu: 'Б' });
      await setup({ isLoading: false, items: [category] });
      fixture.componentInstance['startEdit'](category);
      fixture.componentInstance['editNameHy'].set('');
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['confirmEdit']();
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('sends only the changed names on update', async () => {
      const category = makeAdminCategory({ id: 'c1', name: 'A', nameHy: 'Ա', nameRu: 'Б' });
      await setup({ isLoading: false, items: [category] });
      fixture.componentInstance['startEdit'](category);
      fixture.componentInstance['editNameRu'].set('В');
      const dispatchSpy = vi.spyOn(store, 'dispatch');
      fixture.componentInstance['confirmEdit']();
      expect(dispatchSpy).toHaveBeenCalledWith(
        AdminCategoriesActions.updateCategory({
          id: 'c1',
          request: {
            nameRu: 'В',
            iconName: fixture.componentInstance['editIcon'](),
            colorHex: fixture.componentInstance['editColor'](),
          },
        }),
      );
    });
  });
});
