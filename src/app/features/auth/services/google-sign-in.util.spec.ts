import { decodeGoogleCredentialEmail, googleFailureView } from './google-sign-in.util';

/** A JWT-shaped string whose payload is the given claims (header/signature are filler). */
function credential(claims: unknown): string {
  const json = JSON.stringify(claims);
  const b64url = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `eyJhbGciOiJSUzI1NiJ9.${b64url}.sig`;
}

describe('decodeGoogleCredentialEmail', () => {
  it('reads the email claim from the base64url payload', () => {
    expect(decodeGoogleCredentialEmail(credential({ email: 'anna.p@gmail.com', sub: '1' }))).toBe(
      'anna.p@gmail.com',
    );
  });

  it('decodes a payload that needs base64url padding and non-ASCII claims', () => {
    expect(
      decodeGoogleCredentialEmail(credential({ name: 'Աննա', email: 'a@b.am' })),
    ).toBe('a@b.am');
  });

  it.each([
    ['no email claim', credential({ sub: '1' })],
    ['a non-string email', credential({ email: 42 })],
    ['an email without @', credential({ email: 'nope' })],
    ['an empty email', credential({ email: '  ' })],
    ['an absurdly long email', credential({ email: `${'a'.repeat(300)}@x.am` })],
    ['a payload that is not JSON', 'a.bm90LWpzb24.c'],
    ['a payload that is not base64', 'a.@@@@.c'],
    ['a token with the wrong number of parts', 'only-one-part'],
    ['an empty string', ''],
    ['a JSON array payload', credential([1, 2])],
  ])('returns null for %s (never throws)', (_label, token) => {
    expect(decodeGoogleCredentialEmail(token)).toBeNull();
  });
});

describe('googleFailureView', () => {
  const failure = (errorCode: string | null, status: number | null) => ({
    error: 'x',
    errorCode,
    status,
  });

  it('409 auth.external_pending_registration -> info with a mail icon', () => {
    expect(googleFailureView(failure('auth.external_pending_registration', 409))).toMatchObject({
      kind: 'message',
      key: 'auth.google.ePending',
      tone: 'info',
    });
  });

  it('403 auth.user_blocked -> error', () => {
    expect(googleFailureView(failure('auth.user_blocked', 403))).toMatchObject({
      key: 'auth.google.eBlocked',
      tone: 'error',
    });
  });

  it('429 has no errorCode and is told apart by status -> warn', () => {
    expect(googleFailureView(failure(null, 429))).toMatchObject({
      key: 'auth.google.eRate',
      tone: 'warn',
    });
  });

  it('503 auth.external_provider_unavailable removes the block (also when only the status is known)', () => {
    expect(googleFailureView(failure('auth.external_provider_unavailable', 503))).toEqual({
      kind: 'off',
    });
    expect(googleFailureView(failure(null, 503))).toEqual({ kind: 'off' });
  });

  it('409 auth.external_link_conflict is not a message: the dialog takes over', () => {
    expect(googleFailureView(failure('auth.external_link_conflict', 409))).toEqual({
      kind: 'conflict',
    });
  });

  it.each([
    'auth.external_invalid_token',
    'auth.external_email_missing',
    'auth.external_provider_unsupported',
    'some.future_code',
    null,
  ])('%s -> the generic error', (code) => {
    expect(googleFailureView(failure(code, code === null ? 0 : 400))).toMatchObject({
      key: 'auth.google.eFail',
      tone: 'error',
    });
  });
});
