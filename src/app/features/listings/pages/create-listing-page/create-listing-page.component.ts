import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-create-listing-page',
  standalone: true,
  templateUrl: './create-listing-page.component.html',
  styleUrl: './create-listing-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateListingPageComponent {}
