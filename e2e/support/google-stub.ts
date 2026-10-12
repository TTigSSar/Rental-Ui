import { expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

/**
 * Google Identity Services stand-in for mocked-tier journeys (ADR-030).
 *
 * The real `https://accounts.google.com/gsi/client` cannot run in e2e: it needs the network,
 * an authorised origin and a human in a popup. So:
 *
 *  - the script URL (any `?hl=` query) is fulfilled with a small JS file, and
 *  - that file installs on each load `window.google.accounts.id` as a recorder that keeps
 *    every `initialize` / `renderButton` call (with its options) and exposes a hook that fires
 *    the callback registered by the LAST `initialize`, exactly as GIS would after a popup.
 *
 * The recorder's `renderButton` appends a fake button into the container and records how many
 * children the container had when it was called, so "the container was emptied before the
 * render" (ADR-030 section 3) is observable: it is 0 on every render only if the SPA emptied it.
 */
export interface GsiInitialize {
  client_id: string;
  nonce?: string;
  ux_mode?: string;
}
export interface GsiRender {
  /** Children of the container at call time - 0 means the SPA emptied it first. */
  childrenBefore: number;
  options: Record<string, unknown>;
}
export interface GsiState {
  /** Call order, e.g. ['initialize:e2e-nonce-1', 'render', 'initialize:e2e-nonce-2', 'render']. */
  events: string[];
  inits: GsiInitialize[];
  renders: GsiRender[];
  /** `src` of every GIS script execution, e.g. ['.../gsi/client?hl=en', '.../gsi/client?hl=ru']. */
  loads: string[];
}

/**
 * Runs INSIDE the page every time the (fulfilled) GIS script executes - the stand-in for what
 * the real `gsi/client` does on load: (re)create `window.google.accounts.id`. The SPA removes the
 * script and deletes `google.accounts` on a language switch (5f9a9f1), so the recorder must come
 * back with each load; `window.__gsi` (the recorded calls) deliberately survives it.
 */
function gisScriptBody(): void {
  const w = window as unknown as Record<string, unknown>;
  const state = (w['__gsi'] ??= { events: [], inits: [], renders: [], loads: [], cb: null }) as {
    events: string[];
    inits: unknown[];
    renders: unknown[];
    loads: string[];
    cb: ((response: { credential: string }) => void) | null;
  };
  state.loads.push((document.currentScript as HTMLScriptElement | null)?.src ?? '');
  const google = (w['google'] ??= {}) as Record<string, unknown>;
  google['accounts'] = {
    id: {
      initialize(options: {
        client_id: string;
        nonce?: string;
        ux_mode?: string;
        callback: (response: { credential: string }) => void;
      }) {
        state.inits.push({
          client_id: options.client_id,
          nonce: options.nonce,
          ux_mode: options.ux_mode,
        });
        state.events.push(`initialize:${options.nonce}`);
        state.cb = options.callback;
      },
      renderButton(parent: HTMLElement, options: Record<string, unknown>) {
        state.renders.push({ childrenBefore: parent.childElementCount, options });
        state.events.push('render');
        const fake = document.createElement('div');
        fake.className = 'gsi-stub-button';
        fake.textContent = 'Continue with Google';
        parent.appendChild(fake);
      },
      cancel() {},
    },
  };
  w['__gsiFire'] = (credential: string) => state.cb?.({ credential });
}

export async function installGoogleStub(page: Page): Promise<void> {
  // Any query string: the SPA loads `gsi/client?hl=<ui language>`.
  await page.route(/^https:\/\/accounts\.google\.com\/gsi\/client(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: `(${gisScriptBody.toString()})();`,
    }),
  );
}

export function gsiState(page: Page): Promise<GsiState> {
  return page.evaluate(() => {
    // Absent until the (stubbed) GIS script has executed for the first time.
    const s = (window as unknown as { __gsi?: GsiState }).__gsi ?? {
      events: [],
      inits: [],
      renders: [],
      loads: [],
    };
    return { events: [...s.events], inits: [...s.inits], renders: [...s.renders], loads: [...s.loads] };
  });
}

/** Waits until the SPA has rendered the button `count` times in total. */
export async function expectRenders(page: Page, count: number): Promise<void> {
  await expect.poll(async () => (await gsiState(page)).renders.length).toBe(count);
}

/** A JWT-shaped string: only the base64url payload carries meaning (the SPA reads `email`). */
export function fakeGoogleCredential(claims: Record<string, unknown>): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}.e2e-signature`;
}

/** Fires the callback of the last `initialize`, as GIS does after the popup completes. */
export function fireGoogleCredential(page: Page, credential: string): Promise<void> {
  return page.evaluate(
    (c) => (window as unknown as { __gsiFire: (c: string) => void }).__gsiFire(c),
    credential,
  );
}

/** Records every request the page makes (method + path + parsed body) for later assertions. */
export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
}
export function recordCalls(page: Page): RecordedCall[] {
  const calls: RecordedCall[] = [];
  page.on('request', (req: Request) => {
    const url = new URL(req.url());
    if (!url.pathname.startsWith('/api/') && !url.pathname.includes('/api/')) return;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    calls.push({ method: req.method(), path: url.pathname, body });
  });
  return calls;
}

export function callsTo(calls: RecordedCall[], method: string, pathSuffix: string): RecordedCall[] {
  return calls.filter((c) => c.method === method && c.path.endsWith(pathSuffix));
}
