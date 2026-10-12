import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { LegalDocumentComponent } from '../../components/legal-document/legal-document.component';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [TranslatePipe, LegalDocumentComponent],
  templateUrl: './terms-page.component.html',
  styleUrl: './terms-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsPageComponent {}
