import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { ConversationsPageComponent } from '../conversations-page/conversations-page.component';

/**
 * Desktop master-detail shell for the chat feature.
 *
 * Renders the conversations list in a persistent left rail and the active
 * thread (router-outlet) in the right pane. On desktop both panes are always
 * visible; on mobile the shell collapses to a single column — the rail (list)
 * shows at `/chat` and the outlet (thread) shows at `/chat/:id`, driven purely
 * by CSS keyed off the `chat-shell--thread-open` class.
 *
 * The list component is mounted once here (not duplicated per route), so its
 * NgRx-backed state — and the increment-1 search filter — persist across the
 * list⇄thread navigation that updates only the right pane.
 */
@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [RouterOutlet, TranslatePipe, ConversationsPageComponent],
  templateUrl: './chat-shell.component.html',
  styleUrl: './chat-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatShellComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * True when a `:conversationId` child route is active (a thread is open).
   * Drives the single-column show/hide on mobile and the empty-state pane on
   * desktop. Recomputed on every navigation.
   */
  protected readonly threadOpen = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.hasConversationChild()),
      startWith(this.hasConversationChild()),
    ),
    { initialValue: this.hasConversationChild() },
  );

  private hasConversationChild(): boolean {
    let child = this.route.firstChild;
    while (child) {
      if (child.snapshot.paramMap.has('conversationId')) {
        return true;
      }
      child = child.firstChild;
    }
    return false;
  }
}
