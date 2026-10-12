import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { MessageModule } from 'primeng/message';

import { LanguageService } from '../../../../shared/services/language.service';
import { AuthApiService } from '../../services/auth-api.service';
import { ExternalAuthConfigService } from '../../services/external-auth-config.service';
import { ExternalAuthProviderService } from '../../services/external-auth-provider.service';
import {
  decodeGoogleCredentialEmail,
  googleFailureView,
} from '../../services/google-sign-in.util';
import * as AuthActions from '../../store/auth.actions';
import { selectAuthExternalError, selectExternalAuthPending } from '../../store/auth.selectors';

/** A nonce lives 5 min server-side; a window regaining focus swaps one older than this. */
export const NONCE_STALE_AFTER_MS = 4 * 60 * 1000;
export const GOOGLE_BUTTON_MIN_WIDTH = 200;
export const GOOGLE_BUTTON_MAX_WIDTH = 400;

/**
 * The Google block at the top of both auth-dialog tabs (ADR-030 §3, §9).
 *
 * NONCE LIFECYCLE — the rules, in one place:
 *  - every NEW nonce is `initialize({nonce})` + emptied container + `renderButton`, always
 *    together (`ExternalAuthProviderService.renderGoogleButton` is the only place that does
 *    it; nothing here ever calls `initialize` alone);
 *  - a new nonce is fetched when the dialog opens, after EVERY server answer to /external
 *    (success or error) and when the window regains focus with a nonce older than 4 min and
 *    no /external request in flight. No timer;
 *  - the button is never re-rendered while the window is blurred — that means a Google
 *    popup is open, and re-rendering would disturb the attempt in progress;
 *  - credentials that arrive while an /external request is in flight are ignored;
 *  - language switch / resize re-render with the SAME nonce;
 *  - the token's nonce is never compared with ours on the client — the server decides.
 */
@Component({
  selector: 'app-google-sign-in-block',
  standalone: true,
  imports: [MessageModule, TranslatePipe],
  templateUrl: './google-sign-in-block.component.html',
  styleUrl: './google-sign-in-block.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSignInBlockComponent implements OnInit {
  /** 409 `auth.external_link_conflict`: the dialog switches to Sign in. Carries the
   *  display-only `email` claim of the credential, or null when it has none. */
  @Output() readonly linkConflict = new EventEmitter<string | null>();
  /** A new Google attempt started — the dialog drops its own "email exists" message. */
  @Output() readonly attempt = new EventEmitter<void>();

  private readonly store = inject(Store);
  private readonly authApi = inject(AuthApiService);
  private readonly provider = inject(ExternalAuthProviderService);
  private readonly config = inject(ExternalAuthConfigService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private readonly wrap = viewChild<ElementRef<HTMLElement>>('wrap');

  /** `externalAuth.google.clientId` empty -> the block is not rendered at all. */
  protected readonly configured = this.config.googleClientId !== '';
  /** 503 (nonce or /external) or an unloadable GIS script: block and divider are gone
   *  until the dialog is reopened. */
  protected readonly unavailable = signal(false);
  /** Whether that removal is explained with the warning (only after the user saw the block). */
  private readonly explainUnavailable = signal(false);
  protected readonly showOffMessage = computed(
    () => this.unavailable() && this.explainUnavailable(),
  );
  protected readonly visible = computed(() => this.configured && !this.unavailable());

  /** An /external request is in flight (from the credential until the server answers). */
  readonly busy = signal(false);

  // The dedicated /external flag — NOT the shared `isLoading` (login/register/me would
  // release the busy lock early).
  private readonly externalPending = this.store.selectSignal(selectExternalAuthPending);
  private readonly externalError = this.store.selectSignal(selectAuthExternalError);

  protected readonly failure = computed(() => {
    const failure = this.externalError();
    return failure === null ? null : googleFailureView(failure);
  });
  protected readonly message = computed(() => {
    const view = this.failure();
    return view !== null && view.kind === 'message' ? view : null;
  });

  private nonce: string | null = null;
  private nonceFetchedAt = 0;
  private nonceRequestInFlight = false;
  /** The window lost focus: a Google popup is open. Never re-render while true. */
  private blurred = false;
  /** A render was wanted while blurred / busy; done when focus returns / the answer lands. */
  private renderPending = false;
  private viewReady = false;
  private destroyed = false;
  private requestSeenLoading = false;
  private lastCredentialEmail: string | null = null;
  private lastRenderedWidth = 0;
  private resizeObserver: ResizeObserver | null = null;

  private readonly onCredential = (idToken: string): void => this.handleCredential(idToken);

  constructor() {
    afterNextRender(() => {
      this.viewReady = true;
      this.observeWidth();
      this.renderIfAllowed();
    });

    // The server answered: /external is no longer in flight. Every answer (success or
    // error) is followed by a fresh nonce — the one the credential carried is consumed.
    effect(() => {
      if (!this.busy()) {
        return;
      }
      if (this.externalPending()) {
        this.requestSeenLoading = true;
        return;
      }
      // Only a loading -> idle transition is an answer; "idle" right after the dispatch,
      // before the store has flipped, is not.
      if (!this.requestSeenLoading) {
        return;
      }
      this.requestSeenLoading = false;
      this.busy.set(false);
      this.refreshNonce();
    });

    // 409 link conflict -> the dialog takes over (Sign in tab, prefilled email).
    effect(() => {
      const view = this.failure();
      if (view === null) {
        return;
      }
      if (view.kind === 'conflict') {
        this.linkConflict.emit(this.lastCredentialEmail);
      } else if (view.kind === 'off') {
        this.explainUnavailable.set(true);
        this.unavailable.set(true);
      }
    });

    // Language switch -> same nonce, new label language.
    effect(() => {
      this.languageService.current();
      if (this.viewReady) {
        this.renderIfAllowed();
      }
    });

    const onBlur = (): void => {
      this.blurred = true;
    };
    const onFocus = (): void => this.handleWindowFocus();
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      this.resizeObserver?.disconnect();
      this.provider.releaseGoogleButton(this.onCredential);
    });
  }

  ngOnInit(): void {
    if (this.configured) {
      this.refreshNonce();
    }
  }

  /** Window regained focus: the popup (if any) is closed. */
  private handleWindowFocus(): void {
    this.blurred = false;
    if (this.busy() || this.unavailable() || !this.configured) {
      return;
    }
    if (this.renderPending && this.nonce !== null) {
      this.renderIfAllowed();
      return;
    }
    if (this.nonce === null || Date.now() - this.nonceFetchedAt > NONCE_STALE_AFTER_MS) {
      this.refreshNonce();
    }
  }

  private refreshNonce(): void {
    if (this.destroyed || !this.configured || this.unavailable() || this.nonceRequestInFlight) {
      return;
    }
    this.nonceRequestInFlight = true;
    this.authApi.externalNonce().subscribe({
      next: ({ nonce }) => {
        this.nonceRequestInFlight = false;
        if (this.destroyed) {
          return;
        }
        this.nonce = nonce;
        this.nonceFetchedAt = Date.now();
        this.renderPending = true;
        this.renderIfAllowed();
      },
      error: (error: unknown) => {
        this.nonceRequestInFlight = false;
        if (this.destroyed) {
          return;
        }
        const status = (error as { status?: number } | null)?.status;
        if (status === 503) {
          // Same as the provider being unavailable: block and divider go. The warning
          // is only worth showing to someone who already saw the button.
          this.explainUnavailable.set(this.nonce !== null);
          this.unavailable.set(true);
        }
        // Anything else (429, a dropped connection): keep what is rendered; the next
        // answer or the next focus retries.
      },
    });
  }

  /**
   * Renders the button — unless that would break something: no host/nonce yet, the
   * window is blurred (a popup is open) or an /external request is in flight. A render
   * that is held back is remembered and done when focus returns / the answer lands.
   */
  private renderIfAllowed(): void {
    if (this.destroyed || !this.viewReady || this.nonce === null || this.unavailable()) {
      return;
    }
    if (this.blurred || this.busy()) {
      this.renderPending = true;
      return;
    }
    const host = this.host()?.nativeElement;
    if (host === undefined) {
      return;
    }
    this.renderPending = false;
    const width = this.measureWidth();
    this.lastRenderedWidth = width;
    this.provider
      .renderGoogleButton(host, this.onCredential, {
        nonce: this.nonce,
        locale: this.languageService.current().code,
        width,
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
      })
      .catch(() => {
        // GIS script blocked or unloadable: password sign-in stays, silently.
        if (!this.destroyed) {
          this.unavailable.set(true);
        }
      });
  }

  private measureWidth(): number {
    const el = this.wrap()?.nativeElement;
    const available = el?.clientWidth ?? 0;
    const width = available > 0 ? available : GOOGLE_BUTTON_MAX_WIDTH;
    return Math.min(GOOGLE_BUTTON_MAX_WIDTH, Math.max(GOOGLE_BUTTON_MIN_WIDTH, Math.round(width)));
  }

  /** Resize -> same nonce, new width (design: measure on open, re-render on resize). */
  private observeWidth(): void {
    const el = this.wrap()?.nativeElement;
    if (el === undefined || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => {
      if (this.measureWidth() !== this.lastRenderedWidth) {
        this.renderIfAllowed();
      }
    });
    this.resizeObserver.observe(el);
  }

  private handleCredential(idToken: string): void {
    // An answer for the previous credential is still pending: ignore (one at a time).
    if (this.busy() || this.destroyed) {
      return;
    }
    this.lastCredentialEmail = decodeGoogleCredentialEmail(idToken);
    this.requestSeenLoading = false;
    this.busy.set(true);
    this.attempt.emit();
    this.store.dispatch(AuthActions.externalAuth({ provider: 'google', idToken }));
  }
}
