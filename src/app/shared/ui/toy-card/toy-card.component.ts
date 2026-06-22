import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export interface ToyCardData {
  id: number;
  title: string;
  age: string;
  rating: number;
  owner: string;
  pricePerDay: number;
  available: boolean;
  imageUrl: string;
}

@Component({
  selector: 'app-toy-card',
  standalone: true,
  imports: [IconComponent, DecimalPipe],
  templateUrl: './toy-card.component.html',
  styleUrl: './toy-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToyCardComponent {
  readonly toy = input.required<ToyCardData>();
}
