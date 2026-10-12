import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LegalDocumentComponent } from '../../components/legal-document/legal-document.component';

@Component({
  selector: 'app-privacy-page',
  standalone: true,
  imports: [TranslatePipe, LegalDocumentComponent],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {}
