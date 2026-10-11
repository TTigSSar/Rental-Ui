import type { ExternalAuthError } from '../store/auth.state';

/**
 * Display-only: the `email` claim of the Google credential the SPA already holds.
 * It prefills the Sign in tab after a 409 `auth.external_link_conflict` (ADR-030 §9) and
 * is NEVER sent to the API as an identity — the server reads the verified token itself.
 *
 * The payload is base64url JSON. Anything malformed, absent or implausible yields null:
 * a broken credential must degrade to "no prefill", never throw.
 */
export function decodeGoogleCredentialEmail(idToken: string): string | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof claims !== 'object' || claims === null) {
      return null;
    }
    const email = (claims as Record<string, unknown>)['email'];
    if (typeof email !== 'string') {
      return null;
    }
    const trimmed = email.trim();
    return trimmed.length > 0 && trimmed.length <= 254 && trimmed.includes('@') ? trimmed : null;
  } catch {
    return null;
  }
}

export type GoogleMessageTone = 'info' | 'warn' | 'error';

/** How the Google block answers a failed sign-in (board 1 of the ADR-030 design). */
export type GoogleFailureView =
  /** 409 link conflict: not a message under the button — the dialog switches to Sign in. */
  | { readonly kind: 'conflict' }
  /** 503: the block disappears until the dialog is reopened, with a warning in its place. */
  | { readonly kind: 'off' }
  | {
      readonly kind: 'message';
      readonly key: string;
      readonly tone: GoogleMessageTone;
      readonly icon: string;
    };

/**
 * Maps a failure to its message and tone. By `errorCode`, never by message text; the
 * rate limiter's 429 carries no code, so it is told apart by status. Every token problem
 * (`external_invalid_token`, `external_email_missing`, `external_provider_unsupported`) and
 * any code this file has never heard of land on the generic "couldn't sign in" error.
 */
export function googleFailureView(failure: ExternalAuthError): GoogleFailureView {
  if (failure.status === 429) {
    return { kind: 'message', key: 'auth.google.eRate', tone: 'warn', icon: 'pi pi-exclamation-circle' };
  }
  switch (failure.errorCode) {
    case 'auth.external_link_conflict':
      return { kind: 'conflict' };
    case 'auth.external_provider_unavailable':
      return { kind: 'off' };
    case 'auth.external_pending_registration':
      return { kind: 'message', key: 'auth.google.ePending', tone: 'info', icon: 'pi pi-envelope' };
    case 'auth.user_blocked':
      return { kind: 'message', key: 'auth.google.eBlocked', tone: 'error', icon: 'pi pi-lock' };
    default:
      if (failure.status === 503) {
        return { kind: 'off' };
      }
      return { kind: 'message', key: 'auth.google.eFail', tone: 'error', icon: 'pi pi-exclamation-circle' };
  }
}
