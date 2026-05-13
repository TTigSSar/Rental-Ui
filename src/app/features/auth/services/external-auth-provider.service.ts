import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import type { ExternalAuthProvider } from '../models/auth.models';
import { AppleAuthService } from './apple-auth.service';
import { ExternalAuthConfigService } from './external-auth-config.service';

/**
 * Options for the Google-rendered "Sign in with Google" button.
 * See https://developers.google.com/identity/gsi/web/reference/js-reference#GsiButtonConfiguration.
 */
export interface GoogleButtonRenderOptions {
  readonly type?: 'standard' | 'icon';
  readonly theme?: 'outline' | 'filled_blue' | 'filled_black';
  readonly size?: 'large' | 'medium' | 'small';
  readonly text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  readonly shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  readonly logo_alignment?: 'left' | 'center';
  readonly width?: number;
  readonly locale?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdInitializeOptions {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  ux_mode?: 'popup' | 'redirect';
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
}

interface GoogleIdentityApi {
  initialize(options: GoogleIdInitializeOptions): void;
  renderButton(parent: HTMLElement, options: GoogleButtonRenderOptions): void;
  cancel(): void;
}

type ExternalAuthWindow = Window &
  typeof globalThis & {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  };

/**
 * Drives external-identity sign-in flows.
 *
 * Google: uses the standard **Google Identity Services "Sign in with Google"
 * button** (`google.accounts.id.renderButton`) with `ux_mode: 'popup'`. We no
 * longer trigger One Tap (`prompt()`) — One Tap is far more fragile on
 * `http://localhost:4200` (FedCM / third-party cookies / silent origin bailouts)
 * and was the source of `Error 400: origin_mismatch` surfacing silently in dev.
 *
 * Apple: continues to use the promise-based popup flow via `AppleAuthService`.
 */
@Injectable({ providedIn: 'root' })
export class ExternalAuthProviderService {
  constructor(
    private readonly authConfig: ExternalAuthConfigService,
    private readonly appleAuthService: AppleAuthService,
  ) {}

  private googleScriptReadyPromise: Promise<void> | null = null;
  private googleInitialized = false;
  private googleCredentialCallback: ((idToken: string) => void) | null = null;
  private googleDevDiagnosticLogged = false;

  /**
   * Legacy token-fetching API. Only Apple is supported here now; Google is
   * driven by `renderGoogleButton` instead. Calling this with `'google'` is a
   * programming error — we surface it as an Observable error so the effect
   * funnel can render it like any other auth failure.
   */
  getIdToken(provider: ExternalAuthProvider): Observable<string> {
    if (provider === 'google') {
      return throwError(
        () =>
          new Error(
            'Google sign-in is now driven by the rendered button. Call renderGoogleButton() and dispatch externalAuth with the returned credential instead.',
          ),
      );
    }

    return from(this.appleAuthService.getIdToken());
  }

  /**
   * Renders Google's official "Sign in with Google" button into `container`.
   * Calls `onCredential` with the ID token once the user completes the popup
   * sign-in flow.
   *
   * Safe to call multiple times (e.g. on view re-enter). Initialization with
   * `google.accounts.id.initialize(...)` happens exactly once per page.
   */
  async renderGoogleButton(
    container: HTMLElement,
    onCredential: (idToken: string) => void,
    options: GoogleButtonRenderOptions = {},
  ): Promise<void> {
    const clientId = this.authConfig.googleClientId;
    if (clientId === '') {
      throw new Error(
        'Google sign-in is not configured. Set externalAuth.google.clientId in your environment file.',
      );
    }

    await this.ensureGoogleScript();
    const googleAccounts = (window as ExternalAuthWindow).google?.accounts?.id;
    if (!googleAccounts) {
      throw new Error('Google sign-in is unavailable right now. Please try again later.');
    }

    this.logDevDiagnostic(clientId);

    if (!this.googleInitialized) {
      googleAccounts.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        callback: (response) => {
          const idToken = (response.credential ?? '').trim();
          if (idToken === '') {
            return;
          }
          this.googleCredentialCallback?.(idToken);
        },
      });
      this.googleInitialized = true;
    }

    this.googleCredentialCallback = onCredential;

    googleAccounts.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left',
      width: 320,
      ...options,
    });
  }

  private ensureGoogleScript(): Promise<void> {
    if (this.googleScriptReadyPromise) {
      return this.googleScriptReadyPromise;
    }

    this.googleScriptReadyPromise = this.loadScriptOnce(
      'google-identity-services-script',
      'https://accounts.google.com/gsi/client',
    );

    return this.googleScriptReadyPromise;
  }

  private loadScriptOnce(scriptId: string, src: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * One-shot dev hint that makes `origin_mismatch` trivial to diagnose: prints
   * the exact `window.location.origin` that must appear in the client's
   * "Authorized JavaScript Origins" in Google Cloud Console.
   */
  private logDevDiagnostic(clientId: string): void {
    if (environment.production || this.googleDevDiagnosticLogged) {
      return;
    }

    this.googleDevDiagnosticLogged = true;
    // eslint-disable-next-line no-console
    console.info(
      '[auth:google] Using client_id=%s from origin=%s. If sign-in fails with "Error 400: origin_mismatch", add this origin to "Authorized JavaScript origins" on the OAuth 2.0 Client in Google Cloud Console.',
      clientId,
      window.location.origin,
    );
  }
}
