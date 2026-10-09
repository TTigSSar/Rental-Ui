import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, test } from '@playwright/test';

/**
 * Regression test for ADR-027 (client IP from CF-Connecting-IP via nginx): the shipped
 * `nginx.conf` must OVERWRITE X-Forwarded-For with CF-Connecting-IP on /api/, /uploads/
 * and /hubs/ — never append (`$proxy_add_x_forwarded_for` would let a client-forged
 * X-Forwarded-For through and defeat the per-IP rate limits).
 *
 * This is a response-of-the-real-nginx check no unit test or mocked e2e can see (M-013),
 * but it needs NO app stack: it starts two throwaway containers on a private network —
 * the real `nginx.conf` + `nginx-map.conf` mounted exactly as the Dockerfile copies them
 * (conf.d/00-map.conf, conf.d/default.conf) in front of a tiny nginx "echo" upstream that
 * is reachable as host `api` on :8080 and returns the X-Forwarded-For it received.
 * No SQL Server, no login, no rate-limit budget. Skips cleanly when Docker is unavailable.
 *
 * Limitation: the echo reads `$http_x_forwarded_for`, so an absent header and an
 * empty-valued one are indistinguishable (both echo ""). nginx never sends an empty
 * proxy_set_header value upstream, so this is the same observable contract.
 */
const IMAGE = 'nginx:1.27-alpine';
const UI_ROOT = path.resolve(__dirname, '..', '..');
const RUN_ID = `xfftest-${process.pid}-${Date.now()}`;
const NETWORK = `${RUN_ID}-net`;
const UPSTREAM = `${RUN_ID}-api`;
const UI = `${RUN_ID}-ui`;

const ECHO_CONF = `server {
    listen 8080;
    location / {
        default_type text/plain;
        return 200 "$http_x_forwarded_for";
    }
}
`;

function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function dockerAvailable(): boolean {
  try {
    docker('version', '--format', '{{.Server.Version}}');
    return true;
  } catch {
    return false;
  }
}

function cleanup(): void {
  for (const args of [['rm', '-f', UI], ['rm', '-f', UPSTREAM], ['network', 'rm', NETWORK]]) {
    try {
      docker(...args);
    } catch {
      /* already gone */
    }
  }
}

const HAS_DOCKER = dockerAvailable();
let uiBase = '';
let tmpDir = '';

test.describe('nginx X-Forwarded-For overwrite (ADR-027)', () => {
  test.skip(!HAS_DOCKER, 'Docker daemon is not available - cannot start throwaway nginx containers');

  test.beforeAll(async () => {
    test.setTimeout(120_000);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xff-'));
    const echoConf = path.join(tmpDir, 'echo.conf');
    fs.writeFileSync(echoConf, ECHO_CONF);
    try {
      docker('network', 'create', NETWORK);
      docker('run', '-d', '--name', UPSTREAM, '--network', NETWORK, '--network-alias', 'api',
        '-v', `${echoConf}:/etc/nginx/conf.d/default.conf:ro`, IMAGE);
      docker('run', '-d', '--name', UI, '--network', NETWORK, '-p', '127.0.0.1::80',
        '-v', `${path.join(UI_ROOT, 'nginx-map.conf')}:/etc/nginx/conf.d/00-map.conf:ro`,
        '-v', `${path.join(UI_ROOT, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`, IMAGE);
      const mapped = docker('port', UI, '80/tcp').split('\n')[0]; // 127.0.0.1:49xxx
      uiBase = `http://127.0.0.1:${mapped.split(':').pop()}`;
      // Wait for both nginx processes to answer (bounded poll, not a blind sleep).
      await expect
        .poll(async () => {
          try {
            return (await fetch(`${uiBase}/api/ping`)).status;
          } catch {
            return 0;
          }
        }, { timeout: 30_000, message: 'throwaway nginx pair did not become ready' })
        .toBe(200);
    } catch (e) {
      cleanup();
      throw e;
    }
  });

  test.afterAll(() => {
    if (!HAS_DOCKER) return;
    cleanup();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const prefix of ['/api/', '/uploads/', '/hubs/']) {
    test(`${prefix} replaces a forged X-Forwarded-For with CF-Connecting-IP`, async () => {
      const res = await fetch(`${uiBase}${prefix}probe`, {
        headers: { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '1.2.3.4' },
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('203.0.113.7');
    });

    test(`${prefix} sends no X-Forwarded-For when CF-Connecting-IP is absent`, async () => {
      const res = await fetch(`${uiBase}${prefix}probe`, { headers: { 'X-Forwarded-For': '1.2.3.4' } });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('');
    });
  }
});
