import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

import type { ExternalAuthProvider } from '../models/auth.models';
import { ExternalAuthConfigService } from './external-auth-config.service';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed?: () => boolean;
  isSkippedMoment?: () => boolean;
}

interface GoogleIdentityApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  prompt(listener: (notification: GooglePromptMomentNotification) => void): void;
}

interface AppleSignInResponse {
  authorization?: {
    id_token?: string;
  };
}

interface AppleAuthApi {
  init(config: {
    clientId: string;
    redirectURI: string;
    scope: string;
    state: string;
    usePopup: boolean;
  }): void;
  signIn(): Promise<AppleSignInResponse>;
}

type ExternalAuthWindow = Window &
  typeof globalThis & {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
    AppleID?: {
      auth?: AppleAuthApi;
    };
  };

@Injectable({ providedIn: 'root' })
export class ExternalAuthProviderService {
  constructor(private readonly authConfig: ExternalAuthConfigService) {}

  private googleScriptReadyPromise: Promise<void> | null = null;
  private appleScriptReadyPromise: Promise<void> | null = null;

  getIdToken(provider: ExternalAuthProvider): Observable<string> {
    if (provider === 'google') {
      return from(this.signInWithGoogle());
    }

    return from(this.signInWithApple());
  }

  private async signInWithGoogle(): Promise<string> {
    const clientId = this.authConfig.googleClientId;
    if (clientId === '') {
      throw new Error('Google sign-in is not configured. Please set googleClientId.');
    }

    await this.ensureGoogleScript();
    const authWindow = window as ExternalAuthWindow;
    const googleAccounts = authWindow.google?.accounts?.id;
    if (!googleAccounts) {
      throw new Error('Google sign-in is unavailable right now. Please try again later.');
    }

    return new Promise<string>((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error('Google sign-in was cancelled or timed out.'));
      }, 60000);

      googleAccounts.initialize({
        client_id: clientId,
        callback: (response) => {
          if (settled) {
            return;
          }

          settled = true;
          window.clearTimeout(timeoutId);
          const idToken = (response.credential ?? '').trim();
          if (idToken === '') {
            reject(new Error('Google sign-in did not return an ID token.'));
            return;
          }

          resolve(idToken);
        },
      });

      googleAccounts.prompt((notification) => {
        const isUnavailable = notification.isNotDisplayed?.() ?? false;
        const isSkipped = notification.isSkippedMoment?.() ?? false;
        if ((isUnavailable || isSkipped) && !settled) {
          settled = true;
          window.clearTimeout(timeoutId);
          reject(new Error('Google sign-in is unavailable right now.'));
        }
      });
    });
  }

  private async signInWithApple(): Promise<string> {
    const appleConfig = this.authConfig.appleConfig;
    const clientId = appleConfig.clientId.trim();
    const redirectUri = appleConfig.redirectUri.trim();
    if (clientId === '' || redirectUri === '') {
      throw new Error('Apple sign-in is not configured. Please set clientId and redirectUri.');
    }

    await this.ensureAppleScript();
    const authWindow = window as ExternalAuthWindow;
    const appleAuth = authWindow.AppleID?.auth;
    if (!appleAuth) {
      throw new Error('Apple sign-in is unavailable right now. Please try again later.');
    }

    appleAuth.init({
      clientId,
      redirectURI: redirectUri,
      scope: appleConfig.scope,
      state: appleConfig.state,
      usePopup: true,
    });

    const response = await appleAuth.signIn();
    const idToken = (response.authorization?.id_token ?? '').trim();
    if (idToken === '') {
      throw new Error('Apple sign-in did not return an ID token.');
    }

    return idToken;
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

  private ensureAppleScript(): Promise<void> {
    if (this.appleScriptReadyPromise) {
      return this.appleScriptReadyPromise;
    }

    this.appleScriptReadyPromise = this.loadScriptOnce(
      'apple-signin-script',
      'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
    );

    return this.appleScriptReadyPromise;
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
}
