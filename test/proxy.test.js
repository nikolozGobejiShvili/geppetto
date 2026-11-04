import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../server/config.js';
import { anonymous, createToy, loggedIn, startSite } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC_HOST = 'geppetto.example';
const MAX_FAILED_LOGINS = 5;

function failLogin(site, forwardedFor) {
  return anonymous(site)
    .post('/admin/login')
    .set('X-Forwarded-For', forwardedFor)
    .type('form')
    .send({ password: 'wrong' });
}

async function failLoginUntilBlocked(site, forwardedFor) {
  for (let attempt = 0; attempt < MAX_FAILED_LOGINS; attempt += 1) {
    assert.equal((await failLogin(site, forwardedFor)).status, 401);
  }
}

test('behind the proxy, order messages carry an https toy link', async (t) => {
  const site = await startSite(t, { trustProxy: true });
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({ instagram_url: 'https://www.instagram.com/geppetto.kids/' });
  await createToy(agent);
  const { slug } = site.db.prepare('SELECT slug FROM toys').get();

  const page = await anonymous(site)
    .get(`/toys/${slug}`)
    .set('Host', PUBLIC_HOST)
    .set('X-Forwarded-Proto', 'https');

  assert.match(page.text, new RegExp(`data-order-message="[^"]*https://${PUBLIC_HOST}/toys/${slug}"`));
});

test('behind the proxy, one visitor\'s failed logins do not block another', async (t) => {
  const site = await startSite(t, { trustProxy: true });
  await failLoginUntilBlocked(site, '203.0.113.7');

  assert.equal((await failLogin(site, '203.0.113.7')).status, 429);
  assert.equal((await failLogin(site, '203.0.113.8')).status, 401);
});

test('a blocked visitor cannot escape by sending a made-up address', async (t) => {
  const site = await startSite(t, { trustProxy: true });
  await failLoginUntilBlocked(site, '203.0.113.7');

  // The proxy adds the real address last, after anything the visitor sent.
  assert.equal((await failLogin(site, '198.51.100.9, 203.0.113.7')).status, 429);
});

test('without the proxy setting, forwarded headers are ignored', async (t) => {
  const site = await startSite(t);
  const page = await anonymous(site)
    .get('/')
    .set('Host', PUBLIC_HOST)
    .set('X-Forwarded-Proto', 'https');
  assert.match(page.text, new RegExp(`hreflang="ka" href="http://${PUBLIC_HOST}/"`));

  await failLoginUntilBlocked(site, '203.0.113.7');
  assert.equal((await failLogin(site, '203.0.113.8')).status, 429);
});

test('TRUST_PROXY=1 turns the proxy setting on and it stays off by default', () => {
  assert.equal(readConfig({ TRUST_PROXY: '1' }).trustProxy, true);
  assert.equal(readConfig({}).trustProxy, false);
});

function freePort() {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

test('the started server applies TRUST_PROXY', async (t) => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'geppetto-proxy-'));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const port = await freePort();

  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), HOST: '127.0.0.1', TRUST_PROXY: '1' },
  });
  const exited = new Promise((resolve) => child.on('exit', resolve));
  try {
    await new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk) => {
        if (String(chunk).includes(String(port))) resolve();
      });
      child.on('exit', () => reject(new Error('The server stopped before it was ready')));
    });

    const response = await fetch(`http://127.0.0.1:${port}/`, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.match(await response.text(), new RegExp(`hreflang="ka" href="https://127\\.0\\.0\\.1:${port}/"`));
  } finally {
    child.kill();
    await exited;
  }
});
