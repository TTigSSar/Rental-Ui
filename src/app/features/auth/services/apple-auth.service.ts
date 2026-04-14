import { Injectable } from '@angular/core';

import { ExternalAuthConfigService } from './external-auth-config.service';

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

type AppleAuthWindow = Window &
  typeof globalThis & {
    AppleID?: {
      auth?: AppleAuthApi;
    };
  };

@Injectable({ providedIn: 'root' })
export class AppleAuthService {
  constructor(private readonly externalAuthConfig: ExternalAuthConfigService) {}

  private scriptReadyPromise: Promise<void> | null = null;

  async getIdToken(): Promise<string> {
    const clientId = this.externalAuthConfig.appleClientId;
    const redirectUri = this.externalAuthConfig.appleRedirectUri;
    if (clientId === '' || redirectUri === '') {
      throw new Error('Apple sign-in is not configured. Please set appleClientId and appleRedirectUri.');
    }

    await this.ensureAppleScript();
    const authWindow = window as AppleAuthWindow;
    const appleAuth = authWindow.AppleID?.auth;
    if (!appleAuth) {
      throw new Error('Apple sign-in is unavailable right now. Please try again later.');
    }

    const appleConfig = this.externalAuthConfig.appleConfig;
    appleAuth.init({
      clientId,
      redirectURI: redirectUri,
      scope: appleConfig.scope,
      state: appleConfig.state,
      usePopup: appleConfig.usePopup,
    });

    const response = await appleAuth.signIn();
    const idToken = (response.authorization?.id_token ?? '').trim();
    if (idToken === '') {
      throw new Error('Apple sign-in did not return an ID token.');
    }

    return idToken;
  }

  private ensureAppleScript(): Promise<void> {
    if (this.scriptReadyPromise) {
      return this.scriptReadyPromise;
    }

    const scriptSrc = this.externalAuthConfig.appleConfig.scriptSrc.trim();
    if (scriptSrc === '') {
      throw new Error('Apple sign-in script URL is not configured.');
    }

    this.scriptReadyPromise = new Promise<void>((resolve, reject) => {
      const scriptId = 'apple-signin-script';
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = scriptSrc;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${scriptSrc}`));
      document.head.appendChild(script);
    });

    return this.scriptReadyPromise;
  }
}
