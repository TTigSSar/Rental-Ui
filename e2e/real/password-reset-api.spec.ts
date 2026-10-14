import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  ACCOUNTS,
  API_URL,
  apiLogin,
  apiRegisterWithId,
  assertDockerStack,
  assertLoginNotRateLimited,
  awaitRateWindow,
  noteAuthSpend,
  noteRateSpend,
  readResetTokens,
  runDockerDbSql,
  waitForResetTokens,
} from '../support/real-stack';

/**
 * Cross-layer API tests for the parts of password reset (ADR-035) that only mean something on
 * the real stack: the conditional, transactional writes against real SQL Server (backend tests
 * run on SQLite, where a conditional UPDATE inside a SERIALIZABLE-ish transaction proves nothing).
 * No browser: the cheapest layer that reaches the real store.
 *
 *  - 2a: a reset must not outlive an admin block (ADR-035 section 2/4: the password UPDATE is
 *    conditional on `IsBlocked = 0`, and a blocked re-read answers 400 `reset_token_invalid`).
 *    Deterministic order (block, then reset) AND a genuine race (reset and suspend in flight
 *    together): whatever the interleaving, afterwards the account is blocked and NO token that
 *    exists (the pre-block JWT, a JWT handed out by a reset that won the race) reaches /me.
 *  - 2b: concurrent forgot-password for one user must leave exactly ONE live reset token, send
 *    one mail, and answer 202 to every caller with no 5xx (cooldown is a conditional revoke in
 *    the store, ADR-035 section 2 / ADR-028 R1).
 *
 * Fixture users are fresh throwaways (deterministic data per run, no shared demo account
 * mutated). Budgets: see the `awaitRateWindow` calls; `password-reset` is 5/min per IP.
 */

const NEW_PASSWORD = 'E2eReset-New1';

function details(slug: string, phoneSuffix: string) {
  const runId = Date.now().toString(36);
  return {
    firstName: 'Qa',
    lastName: 'ResetApi',
    phone: `+3749123${phoneSuffix}`,
    email: `qa.reset.${slug}.${runId}@rental.local`,
    password: 'Demo1234',
  };
}

async function forgot(request: APIRequestContext, email: string) {
  noteRateSpend('direct', 1);
  return request.post(`${API_URL}/api/auth/forgot-password`, {
    data: { email, preferredLanguage: 'en' },
    failOnStatusCode: false,
  });
}

function assertResetNotRateLimited(status: number, what: string): void {
  if (status !== 429) return;
  throw new Error(
    `Real-stack password-reset budget exhausted at "${what}" (429): the "password-reset" policy is ` +
      `5/min per client IP, shared by forgot-password, reset-password/check and reset-password. ` +
      `Not a flake and not a regression - see awaitRateWindow in support/real-stack.ts.`,
  );
}

async function resetPost(
  request: APIRequestContext,
  token: string,
  newPassword: string,
  what: string,
) {
  noteRateSpend('direct', 1);
  const res = await request.post(`${API_URL}/api/auth/reset-password`, {
    data: { token, newPassword },
    failOnStatusCode: false,
  });
  assertResetNotRateLimited(res.status(), what);
  return res;
}

async function suspend(request: APIRequestContext, userId: string) {
  const adminJwt = await apiLogin(request, ACCOUNTS.admin);
  return request.post(`${API_URL}/api/admin/users/${userId}/suspend`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
    data: { reason: 'qa password-reset race' },
    failOnStatusCode: false,
  });
}

test.describe('Password reset - cross-layer API (real stack)', () => {
  test('2a: a reset never outlives an admin block (sequential)', async ({ request }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 3);
    await awaitRateWindow('password-reset', 'direct', 3);

    const user = details('block', '571');
    const { jwt, id } = await apiRegisterWithId(request, user);

    expect((await forgot(request, user.email)).status()).toBe(202);
    const [token] = await waitForResetTokens(user.email, 1);

    const hashBefore = runDockerDbSql(`SELECT PasswordHash FROM Users WHERE Id = '${id}'`);
    expect(hashBefore.length).toBeGreaterThan(10);

    const suspendRes = await suspend(request, id);
    expect(suspendRes.status(), `suspend: ${await suspendRes.text()}`).toBe(200);

    noteRateSpend('direct', 1);
    const check = await request.post(`${API_URL}/api/auth/reset-password/check`, {
      data: { token },
      failOnStatusCode: false,
    });
    assertResetNotRateLimited(check.status(), 'check for blocked owner');
    expect(check.status()).toBe(400);
    expect(((await check.json()) as { errorCode?: string }).errorCode).toBe(
      'auth.reset_token_invalid',
    );

    const reset = await resetPost(request, token, NEW_PASSWORD, 'reset for blocked owner');
    expect(reset.status(), await reset.text()).toBe(400);
    expect(((await reset.json()) as { errorCode?: string }).errorCode).toBe(
      'auth.reset_token_invalid',
    );

    // Real SQL Server state: the password was not touched and the token was not consumed.
    expect(runDockerDbSql(`SELECT PasswordHash FROM Users WHERE Id = '${id}'`)).toBe(hashBefore);
    expect(
      runDockerDbSql(
        `SELECT COUNT(*) FROM UserTokens WHERE UserId = '${id}' AND Purpose = 2 AND ConsumedAt IS NULL`,
      ),
    ).toBe('1');

    // No surviving token grants access: neither the pre-block JWT nor a login.
    const me = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
      failOnStatusCode: false,
    });
    expect(me.ok(), 'a blocked user must not reach /me with a pre-block JWT').toBe(false);

    noteAuthSpend('direct', `login of blocked fixture ${user.email}`);
    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: user.email, password: user.password },
      failOnStatusCode: false,
    });
    assertLoginNotRateLimited(login.status(), user.email);
    expect(login.ok(), 'a blocked user must not sign in').toBe(false);
  });

  test('2a: reset and admin block in flight together never leave a working session', async ({
    request,
  }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 3);
    await awaitRateWindow('password-reset', 'direct', 2);

    const user = details('race', '572');
    const { jwt, id } = await apiRegisterWithId(request, user);
    expect((await forgot(request, user.email)).status()).toBe(202);
    const [token] = await waitForResetTokens(user.email, 1);

    // Warm the admin login BEFORE the race so both requests start together.
    await apiLogin(request, ACCOUNTS.admin);
    const [resetRes, suspendRes] = await Promise.all([
      resetPost(request, token, NEW_PASSWORD, 'racing reset'),
      suspend(request, id),
    ]);
    expect(suspendRes.status(), await suspendRes.text()).toBe(200);
    expect([200, 400], `reset answered ${resetRes.status()} ${await resetRes.text()}`).toContain(
      resetRes.status(),
    );

    const tokensToTry = [jwt];
    if (resetRes.status() === 200) {
      const body = (await resetRes.json()) as { token?: string; accessToken?: string };
      tokensToTry.push((body.accessToken ?? body.token)!);
    } else {
      expect(((await resetRes.json()) as { errorCode?: string }).errorCode).toBe(
        'auth.reset_token_invalid',
      );
    }
    for (const t of tokensToTry) {
      const me = await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
        failOnStatusCode: false,
      });
      expect(me.ok(), 'a blocked user must not reach /me with any issued JWT').toBe(false);
    }

    // Whichever password the account ended up with, it cannot sign in.
    noteAuthSpend('direct', `login of blocked race fixture ${user.email}`);
    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: user.email,
        password: resetRes.status() === 200 ? NEW_PASSWORD : user.password,
      },
      failOnStatusCode: false,
    });
    assertLoginNotRateLimited(login.status(), user.email);
    expect(login.ok(), 'a blocked user must not sign in').toBe(false);
    expect(login.status()).toBe(403);
  });

  test('2b: concurrent forgot-password leaves exactly one live token and one working link', async ({
    request,
  }) => {
    await assertDockerStack(request);
    await awaitRateWindow('auth', 'direct', 1);
    await awaitRateWindow('password-reset', 'direct', 5);

    const user = details('par', '573');
    const { id } = await apiRegisterWithId(request, user);

    const responses = await Promise.all([
      forgot(request, user.email),
      forgot(request, user.email),
      forgot(request, user.email),
    ]);
    for (const r of responses) {
      assertResetNotRateLimited(r.status(), 'parallel forgot-password');
      expect(r.status(), 'every concurrent forgot-password answers 202 (never 5xx)').toBe(202);
    }

    // Real SQL Server state: one live token (revocations of an older one would show as ConsumedAt).
    expect(
      runDockerDbSql(
        `SELECT COUNT(*) FROM UserTokens WHERE UserId = '${id}' AND Purpose = 2 AND ConsumedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()`,
      ),
    ).toBe('1');

    const tokens = await waitForResetTokens(user.email, 1);
    expect(tokens, 'exactly one reset mail is produced for parallel requests').toHaveLength(1);
    expect(readResetTokens(user.email)).toHaveLength(1);

    const ok = await resetPost(request, tokens[0], NEW_PASSWORD, 'reset with the surviving link');
    expect(ok.status(), await ok.text()).toBe(200);
    const again = await resetPost(request, tokens[0], 'E2eReset-Other2', 'second use of the link');
    expect(again.status()).toBe(400);
    expect(((await again.json()) as { errorCode?: string }).errorCode).toBe(
      'auth.reset_token_invalid',
    );
  });
});
