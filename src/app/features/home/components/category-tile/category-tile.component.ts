import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  input,
} from '@angular/core';

export interface HomeCategoryTileVm {
  readonly id: string | null;
  readonly slug: string;
  readonly label: string;
  readonly icon: string;
  readonly tintA: string;
  readonly tintB: string;
}

@Component({
  selector: 'app-home-category-tile',
  standalone: true,
  imports: [],
  templateUrl: './category-tile.component.html',
  styleUrl: './category-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryTileComponent {
  readonly category = input.required<HomeCategoryTileVm>();

  @Output() readonly select = new EventEmitter<HomeCategoryTileVm>();

  protected onClick(): void {
    this.select.emit(this.category());
  }
}
