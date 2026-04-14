import { Injectable } from '@angular/core';

import { environment } from '../../../../environments/environment';

interface ExternalAuthConfig {
  googleClientId: string;
  apple: {
    clientId: string;
    redirectUri: string;
    scope: string;
    state: string;
  };
}

@Injectable({ providedIn: 'root' })
export class ExternalAuthConfigService {
  private readonly config: ExternalAuthConfig = {
    googleClientId: environment.externalAuth.googleClientId,
    apple: {
      clientId: environment.externalAuth.apple.clientId,
      redirectUri: environment.externalAuth.apple.redirectUri,
      scope: environment.externalAuth.apple.scope,
      state: environment.externalAuth.apple.state,
    },
  };

  get googleClientId(): string {
    return this.config.googleClientId.trim();
  }

  get appleConfig(): ExternalAuthConfig['apple'] {
    return this.config.apple;
  }
}
