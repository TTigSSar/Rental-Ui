import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {}
