import { makeUser } from '../../../../testing/fixtures';
import * as AuthActions from './auth.actions';
import { authReducer } from './auth.reducer';
import { initialAuthState, type AuthState } from './auth.state';

function stateWith(overrides: Partial<AuthState>): AuthState {
  return { ...initialAuthState, ...overrides };
}

describe('authReducer', () => {
  describe('request start', () => {
    it.each([
      AuthActions.login({ payload: { email: 'a', password: 'b' } }),
      AuthActions.register({
        payload: {
          email: 'a',
          password: 'b',
          firstName: 'A',
          lastName: 'B',
          phoneNumber: '1',
        },
      }),
      AuthActions.loadCurrentUser(),
    ])('sets isLoading and clears the error for %s', (action) => {
      const next = authReducer(stateWith({ error: 'old' }), action);
      expect(next.isLoading).toBe(true);
      expect(next.error).toBeNull();
    });
  });

  describe('auth success (token known)', () => {
    it('marks authenticated and ends initialization on loginSuccess', () => {
      const next = authReducer(initialAuthState, AuthActions.loginSuccess({ token: 'jwt' }));
      expect(next).toMatchObject({
        token: 'jwt',
        isAuthenticated: true,
        isInitializing: false,
        isLoading: false,
        error: null,
      });
    });
  });

  it('stores the user and confirms auth on loadCurrentUserSuccess', () => {
    const user = makeUser();
    const next = authReducer(
      stateWith({ token: 'jwt', isInitializing: true }),
      AuthActions.loadCurrentUserSuccess({ user }),
    );
    expect(next.user).toBe(user);
    expect(next.isAuthenticated).toBe(true);
    expect(next.isInitializing).toBe(false);
  });

  describe('loadCurrentUserFailure preserveSession contract', () => {
    const authed = stateWith({
      token: 'jwt',
      isAuthenticated: true,
      user: makeUser(),
      isInitializing: true,
    });

    it('clears token and auth when session is NOT preserved (401 / token rejected)', () => {
      const next = authReducer(
        authed,
        AuthActions.loadCurrentUserFailure({ error: 'Unauthorized', preserveSession: false }),
      );
      expect(next.token).toBeNull();
      expect(next.isAuthenticated).toBe(false);
      expect(next.user).toBeNull();
      expect(next.isInitializing).toBe(false);
    });

    it('keeps token and auth when session IS preserved (transient / non-401)', () => {
      const next = authReducer(
        authed,
        AuthActions.loadCurrentUserFailure({ error: 'Network', preserveSession: true }),
      );
      expect(next.token).toBe('jwt');
      expect(next.isAuthenticated).toBe(true);
      expect(next.user).toBeNull(); // user is always cleared
      expect(next.error).toBe('Network');
    });

    it('defaults to NOT preserving the session when the flag is omitted', () => {
      const next = authReducer(
        authed,
        AuthActions.loadCurrentUserFailure({ error: 'oops' }),
      );
      expect(next.token).toBeNull();
      expect(next.isAuthenticated).toBe(false);
    });
  });

  it('confirms an anonymous session on authInitCompleted', () => {
    const next = authReducer(initialAuthState, AuthActions.authInitCompleted());
    expect(next.isInitializing).toBe(false);
    expect(next.isAuthenticated).toBe(false);
    expect(next.token).toBeNull();
  });

  it('fully clears auth on logout without re-entering initialization', () => {
    const next = authReducer(
      stateWith({ token: 'jwt', isAuthenticated: true, user: makeUser() }),
      AuthActions.logout(),
    );
    expect(next.token).toBeNull();
    expect(next.isAuthenticated).toBe(false);
    expect(next.user).toBeNull();
    // Critical: logout must NOT set isInitializing back to true (would hang guards).
    expect(next.isInitializing).toBe(false);
  });

  it('clears only the error on clearAuthError', () => {
    const next = authReducer(
      stateWith({ token: 'jwt', isAuthenticated: true, error: 'bad creds' }),
      AuthActions.clearAuthError(),
    );
    expect(next.error).toBeNull();
    expect(next.token).toBe('jwt');
    expect(next.isAuthenticated).toBe(true);
  });

  it('records the error on loginFailure without flipping authentication', () => {
    const next = authReducer(
      stateWith({ isLoading: true }),
      AuthActions.loginFailure({ error: 'Invalid credentials' }),
    );
    expect(next.error).toBe('Invalid credentials');
    expect(next.isLoading).toBe(false);
    expect(next.isAuthenticated).toBe(false);
  });
});
