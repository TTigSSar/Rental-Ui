import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export interface CategoryOption {
  id: string;
  name: string;
  iconUrl?: string;
  listingCount?: number;
}

@Component({
  selector: 'app-category-selector',
  standalone: true,
  imports: [],
  templateUrl: './category-selector.component.html',
  styleUrl: './category-selector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySelectorComponent {
  @ViewChild('triggerRef') private readonly triggerRef!: ElementRef<HTMLButtonElement>;

  readonly categories = input.required<CategoryOption[]>();
  readonly selectedCategoryId = input<string | null>(null);
  readonly placeholder = input<string>('');

  readonly categoryChange = output<string | null>();

  protected readonly isOpen = signal(false);
  protected readonly focusedIndex = signal(-1);
  protected readonly panelStyle = signal<{ top: string; left: string; width: string } | null>(null);
  protected readonly panelId = `cs-panel-${Math.random().toString(36).slice(2, 8)}`;

  protected readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    if (!id) return null;
    return this.categories().find((c) => c.id === id) ?? null;
  });

  protected toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  protected open(): void {
    const rect = this.triggerRef.nativeElement.getBoundingClientRect();
    const offset = this.transformedAncestorOffset();
    this.panelStyle.set({
      top: `${rect.bottom + 6 - offset.y}px`,
      left: `${rect.left - offset.x}px`,
      width: `${rect.width}px`,
    });
    this.isOpen.set(true);
    const selectedIdx = this.categories().findIndex((c) => c.id === this.selectedCategoryId());
    this.focusedIndex.set(selectedIdx >= 0 ? selectedIdx : 0);
  }

  // CSS `transform` on an ancestor makes it the containing block for position:fixed children,
  // so viewport coordinates from getBoundingClientRect must be adjusted by the ancestor's offset.
  private transformedAncestorOffset(): { x: number; y: number } {
    let el: Element | null = this.triggerRef.nativeElement.parentElement;
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      if (style.transform !== 'none' || style.filter !== 'none') {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top };
      }
      el = el.parentElement;
    }
    return { x: 0, y: 0 };
  }

  protected close(): void {
    this.isOpen.set(false);
    this.focusedIndex.set(-1);
  }

  protected select(id: string): void {
    const next = id === this.selectedCategoryId() ? null : id;
    this.categoryChange.emit(next);
    this.close();
  }

  protected clearSelection(): void {
    this.categoryChange.emit(null);
  }

  protected clearSelectionInline(event: Event): void {
    event.stopPropagation();
    this.categoryChange.emit(null);
  }

  @HostListener('keydown', ['$event'])
  protected handleKeydown(event: KeyboardEvent): void {
    const cats = this.categories();

    if (!this.isOpen()) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.open();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.focusedIndex.update((i) => Math.min(i + 1, cats.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.focusedIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        event.preventDefault();
        const idx = this.focusedIndex();
        if (idx >= 0 && idx < cats.length) {
          this.select(cats[idx].id);
        }
        break;
      }
      case 'Escape':
      case 'Tab':
        this.close();
        break;
    }
  }
}
