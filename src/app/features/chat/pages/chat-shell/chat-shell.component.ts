import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';

import { ConversationsPageComponent } from '../conversations-page/conversations-page.component';

/**
 * True when `url` targets an open thread — i.e. there is a non-empty
 * `:conversationId` segment after `/chat/`. `/chat` (inbox) and a bare `/chat/`
 * are false. Derived from the URL string rather than child route snapshots so
 * it is correct on cold direct-nav, when a child `ActivatedRoute.snapshot` is
 * not yet populated (that race threw an NG error and left the pane blank).
 * Mirrors the app-level `isChatUrl` approach.
 */
export function isThreadOpenUrl(url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  const match = /^\/chat\/([^/]+)/.exec(path);
  return match !== null && match[1].length > 0;
}

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

  /**
   * True when a `:conversationId` thread is open. Drives the single-column
   * show/hide on mobile and the empty-state pane on desktop. Recomputed from the
   * router URL on every navigation, and seeded from the current URL so a cold
   * direct-nav to `/chat/:id` opens the thread immediately (no snapshot race).
   */
  protected readonly threadOpen = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => isThreadOpenUrl(this.router.url)),
      startWith(isThreadOpenUrl(this.router.url)),
    ),
    { initialValue: isThreadOpenUrl(this.router.url) },
  );
}
