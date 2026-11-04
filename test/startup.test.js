import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createSite } from '../server/app.js';
import { anonymous } from './helpers.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function tempDir(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'geppetto-start-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function run(script, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', script], {
      cwd: ROOT,
      env: { ...process.env, ...env },
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('exit', (code) => resolve({ code, output }));
  });
}

function occupyPort() {
  return new Promise((resolve) => {
    const blocker = createServer();
    blocker.listen(0, '127.0.0.1', () => resolve(blocker));
  });
}

test('a busy port stops the server with a clear message', async (t) => {
  const blocker = await occupyPort();
  t.after(() => blocker.close());
  const { code, output } = await run('server/index.js', {
    DATA_DIR: tempDir(t),
    PORT: String(blocker.address().port),
    HOST: '127.0.0.1',
  });
  assert.equal(code, 1);
  assert.match(output, /დაკავებულია/);
  assert.doesNotMatch(output, /http:\/\//);
});

test('the reset-password script prints a password that works', async (t) => {
  const dataDir = tempDir(t);
  const first = await createSite({ dataDir, seed: false, log: () => {} });
  first.close();

  const { code, output } = await run('scripts/reset-password.js', { DATA_DIR: dataDir });
  assert.equal(code, 0);
  const password = output.trim().split(/\s+/).pop();

  const site = await createSite({ dataDir, seed: false, log: () => {} });
  try {
    const login = await anonymous(site).post('/admin/login').type('form').send({ password });
    assert.equal(login.status, 302);
  } finally {
    site.close();
  }
});
