import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthApiService } from '../../services/auth-api.service';
import * as AuthActions from '../../store/auth.actions';
import { selectIsAuthenticated } from '../../store/auth.selectors';

export type ChatEmailUnsubscribeState =
  | 'confirm'
  | 'loading'
  | 'failed'
  | 'done'
  | 'invalid'
  | 'already';

/**
 * `/unsubscribe/chat-emails?t=<token>` — landing page of the "Unsubscribe from message emails"
 * link (ADR-059, card 17b). Public: no guard, works signed out. Opening the link changes
 * nothing (mail scanners / previews must not unsubscribe anyone); only the button POSTs.
 * A 400 or a missing `t` is the "link no longer works" state; network / 5xx / 429 keep the
 * button enabled with an error line.
 */
@Component({
  selector: 'app-chat-email-unsubscribe-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './chat-email-unsubscribe-page.component.html',
  styleUrl: './chat-email-unsubscribe-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatEmailUnsubscribePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly authApi = inject(AuthApiService);
  private readonly store = inject(Store);

  private readonly token = (this.route.snapshot.queryParamMap.get('t') ?? '').trim();

  protected readonly state = signal<ChatEmailUnsubscribeState>(
    this.token === '' ? 'invalid' : 'confirm',
  );

  protected unsubscribe(): void {
    if (this.state() === 'loading') {
      return;
    }
    this.state.set('loading');
    this.authApi.unsubscribeChatEmails(this.token).subscribe({
      next: ({ result }) => {
        this.state.set(result === 'alreadyOff' ? 'already' : 'done');
        // Same account signed in on this browser: re-read /me so Settings shows the switch off.
        if (this.store.selectSignal(selectIsAuthenticated)()) {
          this.store.dispatch(AuthActions.loadCurrentUser());
        }
      },
      error: (error: unknown) => {
        this.state.set(
          error instanceof HttpErrorResponse && error.status === 400 ? 'invalid' : 'failed',
        );
      },
    });
  }
}
