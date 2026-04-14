import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-ui-image-container',
  standalone: true,
  template: `<div class="ui-image-frame" [style.aspectRatio]="aspectRatio()"><ng-content /></div>`,
  styleUrl: './image-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageContainerComponent {
  readonly aspectRatio = input<string>('16 / 10');
}
