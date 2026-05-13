import { Injectable } from '@angular/core';

import { environment } from '../../../../environments/environment';

export interface AppleExternalAuthConfig {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  usePopup: boolean;
  scriptSrc: string;
}

interface ExternalAuthConfig {
  google: {
    clientId: string;
  };
  apple: AppleExternalAuthConfig;
}

/**
 * Single source of truth for external-auth configuration.
 *
 * All external-auth client IDs are read from `environment.externalAuth.*`.
 * For Google specifically, the canonical key is `environment.externalAuth.google.clientId`.
 */
@Injectable({ providedIn: 'root' })
export class ExternalAuthConfigService {
  private readonly config: ExternalAuthConfig = {
    google: {
      clientId: environment.externalAuth.google.clientId,
    },
    apple: {
      clientId: environment.externalAuth.apple.clientId,
      redirectUri: environment.externalAuth.apple.redirectUri,
      scope: environment.externalAuth.apple.scope,
      state: environment.externalAuth.apple.state,
      usePopup: environment.externalAuth.apple.usePopup,
      scriptSrc: environment.externalAuth.apple.scriptSrc,
    },
  };

  get googleClientId(): string {
    return this.config.google.clientId.trim();
  }

  get appleClientId(): string {
    return this.config.apple.clientId.trim();
  }

  get appleRedirectUri(): string {
    return this.config.apple.redirectUri.trim();
  }

  get appleConfig(): AppleExternalAuthConfig {
    return this.config.apple;
  }
}
