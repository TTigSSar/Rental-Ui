import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './terms-page.component.html',
  styleUrl: './terms-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPageComponent {}
